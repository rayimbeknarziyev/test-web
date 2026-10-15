<?php
declare(strict_types=1);

final class BookmarkController
{
    public static function index(): never
    {
        $uid = require_auth();
        $page = Request::int('page', 1, 1, 100000);
        $per = Request::int('per_page', 30, 1, 100);
        $offset = ($page - 1) * $per;
        $base = 'FROM bookmarks b JOIN questions q ON q.id = b.question_id JOIN test_versions v ON v.id = q.test_version_id JOIN tests t ON t.id = v.test_id WHERE b.user_id = ? AND t.deleted_at IS NULL AND t.user_id = b.user_id';
        $total = (int) db_value("SELECT COUNT(*) {$base}", [$uid]);
        $rows = db_all("SELECT b.id, b.question_id, b.created_at, q.question_text, t.id AS test_id, t.title AS test_title {$base} ORDER BY b.id DESC LIMIT {$per} OFFSET {$offset}", [$uid]);
        $locked = array_flip(array_map('intval', array_column(db_all(
            "SELECT DISTINCT aq.question_id FROM attempt_questions aq JOIN attempts a ON a.id = aq.attempt_id WHERE a.user_id = ? AND a.status = 'in_progress' AND a.mode = 'exam'",
            [$uid]
        ), 'question_id')));
        $correct = [];
        if ($rows) {
            $ids = array_column($rows, 'question_id');
            $ph = implode(',', array_fill(0, count($ids), '?'));
            foreach (db_all("SELECT question_id, option_text FROM question_options WHERE is_correct = 1 AND question_id IN ({$ph})", $ids) as $o) {
                $correct[(int) $o['question_id']] = $o['option_text'];
            }
        }
        $groups = [];
        foreach ($rows as $r) {
            $tid = (int) $r['test_id'];
            $qid = (int) $r['question_id'];
            $groups[$tid] ??= ['test_id' => $tid, 'title' => $r['test_title'], 'items' => []];
            $groups[$tid]['items'][] = [
                'id' => (int) $r['id'],
                'question_id' => $qid,
                'text' => $r['question_text'],
                'correct_answer' => isset($locked[$qid]) ? null : ($correct[$qid] ?? null),
                'created_at' => $r['created_at'],
            ];
        }
        $counts = array_column(db_all(
            'SELECT v.test_id, COUNT(*) AS c FROM bookmarks b JOIN questions q ON q.id = b.question_id JOIN test_versions v ON v.id = q.test_version_id WHERE b.user_id = ? GROUP BY v.test_id',
            [$uid]
        ), 'c', 'test_id');
        foreach ($groups as $tid => &$g) {
            $g['bookmark_count'] = (int) ($counts[$tid] ?? 0);
        }
        unset($g);
        ok(['groups' => array_values($groups), 'total' => $total, 'page' => $page, 'per_page' => $per]);
    }

    public static function store(): never
    {
        $uid = require_auth();
        $qid = filter_var(Request::json()['question_id'] ?? null, FILTER_VALIDATE_INT);
        if ($qid === false || $qid === null || $qid < 1) {
            throw_validation(['question_id' => 'Savol identifikatori noto‘g‘ri.']);
        }
        $owned = db_value('SELECT q.id FROM questions q JOIN test_versions v ON v.id = q.test_version_id JOIN tests t ON t.id = v.test_id WHERE q.id = ? AND t.user_id = ? AND t.deleted_at IS NULL', [$qid, $uid]);
        if ($owned === null) {
            throw new ApiException(404, 'Savol topilmadi.');
        }
        db_exec('INSERT IGNORE INTO bookmarks (user_id, question_id) VALUES (?, ?)', [$uid, $qid]);
        $id = (int) db_value('SELECT id FROM bookmarks WHERE user_id = ? AND question_id = ?', [$uid, $qid]);
        ok(['id' => $id, 'question_id' => $qid], 'Savol belgilandi.', 201);
    }

    public static function destroy(array $p): never
    {
        $uid = require_auth();
        $id = path_id($p);
        if (db_exec('DELETE FROM bookmarks WHERE id = ? AND user_id = ?', [$id, $uid]) === 0) {
            throw new ApiException(404, 'Belgi topilmadi.');
        }
        ok(null, 'Belgi olib tashlandi.');
    }
}
