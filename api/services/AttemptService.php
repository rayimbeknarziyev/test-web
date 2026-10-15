<?php
declare(strict_types=1);

final class AttemptService
{
    public static function tx(callable $fn): mixed
    {
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $result = $fn();
            $pdo->commit();
            return $result;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function findOwned(int $id, int $uid): array
    {
        $row = db_one('SELECT a.*, t.title AS test_title FROM attempts a JOIN tests t ON t.id = a.test_id WHERE a.id = ? AND a.user_id = ?', [$id, $uid]);
        if ($row === null) {
            throw new ApiException(404, 'Urinish topilmadi.');
        }
        return $row;
    }

    private static function pool(int $uid, array $test, string $source): array
    {
        $tid = (int) $test['id'];
        if ($source === 'test') {
            $vid = TestService::currentVersionId($tid, (int) $test['current_version']);
            return array_map('intval', array_column(db_all('SELECT id FROM questions WHERE test_version_id = ?', [$vid]), 'id'));
        }
        if ($source === 'bookmarks') {
            return array_map('intval', array_column(db_all(
                'SELECT b.question_id FROM bookmarks b JOIN questions q ON q.id = b.question_id JOIN test_versions v ON v.id = q.test_version_id WHERE b.user_id = ? AND v.test_id = ?',
                [$uid, $tid]
            ), 'question_id'));
        }
        return StatsService::unresolvedQuestionIds($uid, $tid);
    }

    public static function create(int $uid, int $testId, array $in): int
    {
        $test = TestService::findOwned($testId, $uid);
        $mode = $in['mode'] ?? '';
        if (!in_array($mode, ['practice', 'exam'], true)) {
            throw_validation(['mode' => 'Rejim noto‘g‘ri.']);
        }
        $source = $in['source'] ?? 'test';
        if (!in_array($source, ['test', 'mistakes', 'bookmarks'], true)) {
            throw_validation(['source' => 'Manba noto‘g‘ri.']);
        }
        if ($source !== 'test') {
            $mode = 'practice';
        }
        $pool = self::pool($uid, $test, $source);
        $available = count($pool);
        if ($available < 1) {
            throw_validation(['count' => 'Bu manbada savollar mavjud emas.']);
        }
        if ($source === 'test') {
            $count = $in['count'] ?? null;
            if ($count === 'all') {
                $n = $available;
            } elseif (is_int($count) && in_array($count, [25, 30, 50], true)) {
                if ($count > $available) {
                    throw_validation(['count' => "Testda atigi {$available} ta savol bor."]);
                }
                $n = $count;
            } else {
                throw_validation(['count' => 'Savollar soni 25, 30 yoki 50 bo‘lishi kerak.']);
            }
        } else {
            $n = min($available, 100);
        }
        $ids = array_slice(secure_shuffle($pool), 0, $n);
        $versionId = TestService::currentVersionId($testId, (int) $test['current_version']);

        return (int) self::tx(function () use ($uid, $testId, $versionId, $mode, $source, $ids) {
            $pdo = db();
            db_exec(
                'INSERT INTO attempts (user_id, test_id, test_version_id, mode, source, total_questions, question_order_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [$uid, $testId, $versionId, $mode, $source, count($ids), json_encode($ids)]
            );
            $attemptId = (int) $pdo->lastInsertId();
            $ph = implode(',', array_fill(0, count($ids), '?'));
            $optRows = db_all("SELECT id, question_id FROM question_options WHERE question_id IN ({$ph})", $ids);
            $byQ = [];
            foreach ($optRows as $o) {
                $byQ[(int) $o['question_id']][] = (int) $o['id'];
            }
            $aqStmt = $pdo->prepare('INSERT INTO attempt_questions (attempt_id, question_id, question_order) VALUES (?, ?, ?)');
            $aqoStmt = $pdo->prepare('INSERT INTO attempt_question_options (attempt_question_id, option_id, display_order) VALUES (?, ?, ?)');
            foreach ($ids as $i => $qid) {
                $aqStmt->execute([$attemptId, $qid, $i + 1]);
                $aqId = (int) $pdo->lastInsertId();
                foreach (secure_shuffle($byQ[$qid] ?? []) as $j => $optId) {
                    $aqoStmt->execute([$aqId, $optId, $j + 1]);
                }
            }
            db_exec('INSERT INTO user_activity (user_id, activity_type, reference_id) VALUES (?, ?, ?)', [$uid, 'attempt_started', $attemptId]);
            return $attemptId;
        });
    }

    private static function formatAttempt(array $a, int $answered): array
    {
        $out = [
            'id' => (int) $a['id'],
            'test_id' => (int) $a['test_id'],
            'test_title' => $a['test_title'] ?? null,
            'mode' => $a['mode'],
            'source' => $a['source'],
            'status' => $a['status'],
            'total_questions' => (int) $a['total_questions'],
            'answered_count' => $answered,
            'current_question_index' => (int) $a['current_question_index'],
            'started_at' => $a['started_at'],
            'completed_at' => $a['completed_at'],
            'result' => null,
        ];
        if ($a['status'] === 'completed') {
            $out['result'] = [
                'correct' => (int) $a['correct_count'],
                'incorrect' => (int) $a['incorrect_count'],
                'unanswered' => (int) $a['unanswered_count'],
                'score' => (int) $a['score'],
                'total' => (int) $a['total_questions'],
                'percentage' => (int) $a['percentage'],
            ];
        }
        return $out;
    }

    private static function loadOptions(int $attemptId): array
    {
        $rows = db_all(
            'SELECT aqo.attempt_question_id, qo.id, qo.option_text, qo.is_correct
             FROM attempt_question_options aqo JOIN question_options qo ON qo.id = aqo.option_id
             JOIN attempt_questions aq ON aq.id = aqo.attempt_question_id
             WHERE aq.attempt_id = ? ORDER BY aqo.attempt_question_id, aqo.display_order',
            [$attemptId]
        );
        $by = [];
        foreach ($rows as $r) {
            $by[(int) $r['attempt_question_id']][] = ['id' => (int) $r['id'], 'text' => $r['option_text'], 'is_correct' => (bool) $r['is_correct']];
        }
        return $by;
    }

    public static function state(int $attemptId, int $uid): array
    {
        $a = self::findOwned($attemptId, $uid);
        $completed = $a['status'] === 'completed';
        $rows = db_all(
            'SELECT aq.id AS aq_id, aq.question_id, aq.question_order, aq.selected_option_id, aq.is_correct, aq.answered_at, q.question_text, q.explanation, b.id AS bookmark_id
             FROM attempt_questions aq JOIN questions q ON q.id = aq.question_id
             LEFT JOIN bookmarks b ON b.question_id = q.id AND b.user_id = ?
             WHERE aq.attempt_id = ? ORDER BY aq.question_order',
            [$uid, $attemptId]
        );
        $options = self::loadOptions($attemptId);
        $answered = 0;
        $questions = [];
        foreach ($rows as $r) {
            $opts = $options[(int) $r['aq_id']] ?? [];
            $answeredRow = $r['selected_option_id'] !== null;
            $answered += $answeredRow ? 1 : 0;
            $item = [
                'attempt_question_id' => (int) $r['aq_id'],
                'question_id' => (int) $r['question_id'],
                'number' => (int) $r['question_order'],
                'text' => $r['question_text'],
                'options' => array_map(static fn($o) => ['id' => $o['id'], 'text' => $o['text']], $opts),
                'selected_option_id' => $answeredRow ? (int) $r['selected_option_id'] : null,
                'bookmark_id' => $r['bookmark_id'] === null ? null : (int) $r['bookmark_id'],
                'revealed' => false,
            ];
            if ($completed || ($a['mode'] === 'practice' && $answeredRow)) {
                $correctId = null;
                foreach ($opts as $o) {
                    if ($o['is_correct']) {
                        $correctId = $o['id'];
                    }
                }
                $item['revealed'] = true;
                $item['is_correct'] = $answeredRow ? ((int) $r['is_correct'] === 1) : null;
                $item['correct_option_id'] = $correctId;
                $item['explanation'] = $r['explanation'];
            }
            $questions[] = $item;
        }
        return ['attempt' => self::formatAttempt($a, $answered), 'questions' => $questions];
    }

    public static function answer(int $attemptId, int $uid, array $in): array
    {
        $aqId = filter_var($in['attempt_question_id'] ?? null, FILTER_VALIDATE_INT);
        $optId = filter_var($in['option_id'] ?? null, FILTER_VALIDATE_INT);
        if ($aqId === false || $aqId === null || $optId === false || $optId === null) {
            throw_validation(['option_id' => 'Savol yoki variant identifikatori noto‘g‘ri.']);
        }
        return self::tx(function () use ($attemptId, $uid, $aqId, $optId) {
            $a = db_one('SELECT * FROM attempts WHERE id = ? AND user_id = ? FOR UPDATE', [$attemptId, $uid]);
            if ($a === null) {
                throw new ApiException(404, 'Urinish topilmadi.');
            }
            if ($a['status'] !== 'in_progress') {
                throw new ApiException(409, 'Bu urinish yakunlangan.');
            }
            $aq = db_one('SELECT aq.*, q.explanation FROM attempt_questions aq JOIN questions q ON q.id = aq.question_id WHERE aq.id = ? AND aq.attempt_id = ?', [$aqId, $attemptId]);
            if ($aq === null) {
                throw new ApiException(404, 'Savol bu urinishga tegishli emas.');
            }
            if (db_value('SELECT 1 FROM attempt_question_options WHERE attempt_question_id = ? AND option_id = ?', [$aqId, $optId]) === null) {
                throw new ApiException(422, 'Variant bu savolga tegishli emas.');
            }
            $locked = $aq['selected_option_id'] !== null;
            if (!$locked) {
                $opt = db_one('SELECT is_correct FROM question_options WHERE id = ?', [$optId]);
                db_exec(
                    'UPDATE attempt_questions SET selected_option_id = ?, is_correct = ?, answered_at = NOW() WHERE id = ? AND selected_option_id IS NULL',
                    [$optId, (int) $opt['is_correct'], $aqId]
                );
                $aq['selected_option_id'] = $optId;
                $aq['is_correct'] = (int) $opt['is_correct'];
            }
            $result = ['attempt_question_id' => $aqId, 'selected_option_id' => (int) $aq['selected_option_id'], 'already_answered' => $locked];
            if ($a['mode'] === 'practice') {
                $correct = db_value('SELECT id FROM question_options WHERE question_id = ? AND is_correct = 1 LIMIT 1', [$aq['question_id']]);
                $result['is_correct'] = (int) $aq['is_correct'] === 1;
                $result['correct_option_id'] = $correct === null ? null : (int) $correct;
                $result['explanation'] = $aq['explanation'];
            }
            return $result;
        });
    }

    public static function progress(int $attemptId, int $uid, array $in): array
    {
        $idx = filter_var($in['current_question_index'] ?? null, FILTER_VALIDATE_INT);
        $a = self::findOwned($attemptId, $uid);
        if ($idx === false || $idx === null || $idx < 0 || $idx >= (int) $a['total_questions']) {
            throw_validation(['current_question_index' => 'Savol indeksi noto‘g‘ri.']);
        }
        if ($a['status'] !== 'in_progress') {
            throw new ApiException(409, 'Bu urinish yakunlangan.');
        }
        db_exec('UPDATE attempts SET current_question_index = ? WHERE id = ? AND status = \'in_progress\'', [$idx, $attemptId]);
        return ['current_question_index' => $idx];
    }

    public static function finish(int $attemptId, int $uid): array
    {
        self::tx(function () use ($attemptId, $uid) {
            $a = db_one('SELECT * FROM attempts WHERE id = ? AND user_id = ? FOR UPDATE', [$attemptId, $uid]);
            if ($a === null) {
                throw new ApiException(404, 'Urinish topilmadi.');
            }
            if ($a['status'] === 'completed') {
                return;
            }
            $s = db_one(
                'SELECT COUNT(*) AS total, COALESCE(SUM(is_correct = 1), 0) AS c, COALESCE(SUM(is_correct = 0), 0) AS w, COALESCE(SUM(selected_option_id IS NULL), 0) AS u FROM attempt_questions WHERE attempt_id = ?',
                [$attemptId]
            );
            $total = (int) $s['total'];
            if ($total < 1) {
                throw new ApiException(422, 'Savollarsiz urinishni yakunlab bo‘lmaydi.');
            }
            $correct = (int) $s['c'];
            $pct = (int) round($correct / $total * 100);
            db_exec(
                "UPDATE attempts SET status = 'completed', correct_count = ?, incorrect_count = ?, unanswered_count = ?, score = ?, percentage = ?, completed_at = NOW() WHERE id = ?",
                [$correct, (int) $s['w'], (int) $s['u'], $correct, $pct, $attemptId]
            );
            db_exec('INSERT INTO user_activity (user_id, activity_type, reference_id) VALUES (?, ?, ?)', [$uid, 'attempt_completed', $attemptId]);
        });
        return self::state($attemptId, $uid)['attempt'];
    }

    public static function review(int $attemptId, int $uid): array
    {
        $a = self::findOwned($attemptId, $uid);
        if ($a['status'] !== 'completed') {
            throw new ApiException(409, 'Javoblarni ko‘rish uchun avval testni yakunlang.');
        }
        $rows = db_all(
            'SELECT aq.id AS aq_id, aq.question_order, aq.selected_option_id, aq.is_correct, q.question_text, q.explanation
             FROM attempt_questions aq JOIN questions q ON q.id = aq.question_id WHERE aq.attempt_id = ? ORDER BY aq.question_order',
            [$attemptId]
        );
        $options = self::loadOptions($attemptId);
        $items = [];
        foreach ($rows as $r) {
            $selected = $r['selected_option_id'] === null ? null : (int) $r['selected_option_id'];
            $opts = array_map(static fn($o) => $o + ['selected' => $o['id'] === $selected], $options[(int) $r['aq_id']] ?? []);
            $items[] = [
                'number' => (int) $r['question_order'],
                'text' => $r['question_text'],
                'explanation' => $r['explanation'],
                'selected_option_id' => $selected,
                'status' => $selected === null ? 'unanswered' : ((int) $r['is_correct'] === 1 ? 'correct' : 'wrong'),
                'options' => $opts,
            ];
        }
        return $items;
    }

    public static function listFor(int $uid, string $status, int $page, int $per): array
    {
        $where = 'a.user_id = ?';
        $params = [$uid];
        if (in_array($status, ['in_progress', 'completed'], true)) {
            $where .= ' AND a.status = ?';
            $params[] = $status;
        }
        $total = (int) db_value("SELECT COUNT(*) FROM attempts a WHERE {$where}", $params);
        $offset = ($page - 1) * $per;
        $rows = db_all(
            "SELECT a.*, t.title AS test_title,
                (SELECT COUNT(*) FROM attempt_questions x WHERE x.attempt_id = a.id AND x.selected_option_id IS NOT NULL) AS answered_count
             FROM attempts a JOIN tests t ON t.id = a.test_id WHERE {$where} ORDER BY a.id DESC LIMIT {$per} OFFSET {$offset}",
            $params
        );
        return [
            'items' => array_map(static fn($r) => self::formatAttempt($r, (int) $r['answered_count']), $rows),
            'total' => $total,
            'page' => $page,
            'per_page' => $per,
        ];
    }
}
