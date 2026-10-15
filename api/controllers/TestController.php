<?php
declare(strict_types=1);

final class TestController
{
    public static function index(): never
    {
        $uid = require_auth();
        $page = Request::int('page', 1, 1, 100000);
        $per = Request::int('per_page', 12, 1, 50);
        $q = Request::str('q', 100);
        $subject = Request::str('subject', 100);
        $sort = Request::str('sort', 20);
        $where = 't.user_id = ? AND t.deleted_at IS NULL';
        $params = [$uid];
        if ($q !== '') {
            $where .= ' AND t.title LIKE ?';
            $params[] = '%' . addcslashes($q, '%_\\') . '%';
        }
        if ($subject !== '') {
            $where .= ' AND t.subject = ?';
            $params[] = $subject;
        }
        $order = match ($sort) {
            'oldest' => 't.created_at ASC, t.id ASC',
            'attempted' => 'last_attempt_at IS NULL, last_attempt_at DESC, t.id DESC',
            default => 't.created_at DESC, t.id DESC',
        };
        $total = (int) db_value("SELECT COUNT(*) FROM tests t WHERE {$where}", $params);
        $offset = ($page - 1) * $per;
        $rows = db_all(
            "SELECT t.*,
               (SELECT COUNT(*) FROM attempts a WHERE a.test_id = t.id AND a.status = 'completed' AND a.source = 'test') AS attempts_count,
               (SELECT MAX(a.percentage) FROM attempts a WHERE a.test_id = t.id AND a.status = 'completed' AND a.source = 'test') AS best_score,
               (SELECT a.percentage FROM attempts a WHERE a.test_id = t.id AND a.status = 'completed' AND a.source = 'test' ORDER BY a.completed_at DESC, a.id DESC LIMIT 1) AS latest_score,
               (SELECT MAX(a.started_at) FROM attempts a WHERE a.test_id = t.id) AS last_attempt_at,
               (SELECT a.id FROM attempts a WHERE a.test_id = t.id AND a.status = 'in_progress' ORDER BY a.id DESC LIMIT 1) AS unfinished_attempt_id
             FROM tests t WHERE {$where} ORDER BY {$order} LIMIT {$per} OFFSET {$offset}",
            $params
        );
        $items = array_map(static fn($r) => TestService::formatTest($r) + [
            'attempts_count' => (int) $r['attempts_count'],
            'best_score' => $r['best_score'] === null ? null : (int) $r['best_score'],
            'latest_score' => $r['latest_score'] === null ? null : (int) $r['latest_score'],
            'last_attempt_at' => $r['last_attempt_at'],
            'unfinished_attempt_id' => $r['unfinished_attempt_id'] === null ? null : (int) $r['unfinished_attempt_id'],
        ], $rows);
        $subjects = array_column(db_all('SELECT DISTINCT subject FROM tests WHERE user_id = ? AND deleted_at IS NULL AND subject IS NOT NULL ORDER BY subject', [$uid]), 'subject');
        ok(['items' => $items, 'total' => $total, 'page' => $page, 'per_page' => $per, 'subjects' => $subjects]);
    }

    public static function store(): never
    {
        $uid = require_auth();
        $id = TestService::create($uid, Request::json());
        ok(['id' => $id], 'Test saqlandi.', 201);
    }

    public static function show(array $p): never
    {
        $uid = require_auth();
        $id = path_id($p);
        $test = TestService::findOwned($id, $uid);
        $versions = db_all('SELECT version_number, question_count, created_at FROM test_versions WHERE test_id = ? ORDER BY version_number DESC', [$id]);
        $mistakes = count(StatsService::unresolvedQuestionIds($uid, $id));
        $bookmarks = (int) db_value('SELECT COUNT(*) FROM bookmarks b JOIN questions q ON q.id = b.question_id JOIN test_versions v ON v.id = q.test_version_id WHERE b.user_id = ? AND v.test_id = ?', [$uid, $id]);
        $unfinished = db_value("SELECT id FROM attempts WHERE test_id = ? AND user_id = ? AND status = 'in_progress' ORDER BY id DESC LIMIT 1", [$id, $uid]);
        ok([
            'test' => TestService::formatTest($test),
            'versions' => $versions,
            'mistakes_count' => $mistakes,
            'bookmarks_count' => $bookmarks,
            'unfinished_attempt_id' => $unfinished === null ? null : (int) $unfinished,
        ]);
    }

    public static function update(array $p): never
    {
        $uid = require_auth();
        $id = path_id($p);
        TestService::findOwned($id, $uid);
        $meta = TestService::normalizeMeta(Request::json(), false);
        if (!$meta) {
            throw_validation(['title' => 'O‘zgartirish uchun ma’lumot yuborilmadi.']);
        }
        $sets = [];
        $params = [];
        foreach ($meta as $col => $val) {
            $sets[] = "{$col} = ?";
            $params[] = $val;
        }
        $params[] = $id;
        db_exec('UPDATE tests SET ' . implode(', ', $sets) . ' WHERE id = ?', $params);
        ok(['test' => TestService::formatTest(TestService::findOwned($id, $uid))], 'Test yangilandi.');
    }

    public static function destroy(array $p): never
    {
        $uid = require_auth();
        $id = path_id($p);
        TestService::findOwned($id, $uid);
        db_exec('UPDATE tests SET deleted_at = NOW() WHERE id = ? AND user_id = ?', [$id, $uid]);
        ok(null, 'Test o‘chirildi. Avvalgi natijalar tarixda saqlanadi.');
    }

    public static function preview(array $p): never
    {
        $uid = require_auth();
        $id = path_id($p);
        $test = TestService::findOwned($id, $uid);
        $versionId = TestService::currentVersionId($id, (int) $test['current_version']);
        $qs = db_all('SELECT id, question_text, explanation FROM questions WHERE test_version_id = ? ORDER BY position', [$versionId]);
        $opts = db_all('SELECT o.id, o.question_id, o.option_text, o.is_correct FROM question_options o JOIN questions q ON q.id = o.question_id WHERE q.test_version_id = ? ORDER BY o.question_id, o.position', [$versionId]);
        $byQ = [];
        foreach ($opts as $o) {
            $byQ[$o['question_id']][] = ['id' => (int) $o['id'], 'text' => $o['option_text'], 'is_correct' => (bool) $o['is_correct']];
        }
        $questions = array_map(static fn($q) => [
            'id' => (int) $q['id'],
            'question' => $q['question_text'],
            'explanation' => $q['explanation'],
            'options' => $byQ[$q['id']] ?? [],
        ], $qs);
        ok(['test' => TestService::formatTest($test), 'questions' => $questions]);
    }

    public static function newVersion(array $p): never
    {
        $uid = require_auth();
        $id = path_id($p);
        $in = Request::json();
        $version = TestService::addVersion($id, $uid, $in['questions'] ?? null);
        ok(['version_number' => $version], 'Savollar yangi versiya sifatida saqlandi.', 201);
    }
}
