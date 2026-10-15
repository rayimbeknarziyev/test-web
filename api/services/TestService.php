<?php
declare(strict_types=1);

final class TestService
{
    public static function maxQuestions(): int
    {
        return (int) cfg('MAX_QUESTIONS_PER_TEST', 2000);
    }

    public static function findOwned(int $testId, int $userId): array
    {
        $row = db_one('SELECT * FROM tests WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [$testId, $userId]);
        if ($row === null) {
            throw new ApiException(404, 'Test topilmadi.');
        }
        return $row;
    }

    public static function normalizeMeta(array $in, bool $titleRequired): array
    {
        $errors = [];
        $out = [];
        if (array_key_exists('title', $in) || $titleRequired) {
            $title = clean_text($in['title'] ?? '', 200, false);
            if ($title === '') {
                $errors['title'] = 'Test nomi 1–200 ta belgidan iborat bo‘lishi kerak.';
            }
            $out['title'] = $title;
        }
        if (array_key_exists('subject', $in)) {
            $subject = clean_text($in['subject'] ?? '', 100, false);
            if (!empty($in['subject']) && $subject === '') {
                $errors['subject'] = 'Fan nomi 100 ta belgidan oshmasligi kerak.';
            }
            $out['subject'] = $subject === '' ? null : $subject;
        }
        if (array_key_exists('description', $in)) {
            $desc = clean_text($in['description'] ?? '', 2000);
            if (!empty($in['description']) && $desc === '') {
                $errors['description'] = 'Tavsif 2000 ta belgidan oshmasligi kerak.';
            }
            $out['description'] = $desc === '' ? null : $desc;
        }
        if ($errors) {
            throw_validation($errors);
        }
        return $out;
    }

    public static function normalizeQuestions(mixed $questions): array
    {
        if (!is_array($questions) || count($questions) < 1) {
            throw_validation(['questions' => 'Kamida bitta savol bo‘lishi kerak.']);
        }
        $max = self::maxQuestions();
        if (count($questions) > $max) {
            throw_validation(['questions' => "Bitta testda {$max} tadan ortiq savol bo‘lishi mumkin emas."]);
        }
        $errors = [];
        $clean = [];
        foreach (array_values($questions) as $i => $q) {
            $n = $i + 1;
            if (!is_array($q)) {
                $errors["q{$n}"] = "{$n}-savol formati noto‘g‘ri.";
                continue;
            }
            $text = clean_text($q['question'] ?? '', 2000);
            if ($text === '') {
                $errors["q{$n}"] = "{$n}-savol matni bo‘sh yoki 2000 belgidan uzun.";
                continue;
            }
            $explanation = clean_text($q['explanation'] ?? '', 2000);
            $options = $q['options'] ?? null;
            if (!is_array($options) || count($options) < 2 || count($options) > 10) {
                $errors["q{$n}"] = "{$n}-savolda 2 tadan 10 tagacha javob varianti bo‘lishi kerak.";
                continue;
            }
            $seen = [];
            $correct = 0;
            $opts = [];
            $bad = false;
            foreach (array_values($options) as $o) {
                $t = is_array($o) ? clean_text($o['text'] ?? '', 1000) : '';
                if ($t === '' || isset($seen[mb_strtolower($t)])) {
                    $bad = true;
                    break;
                }
                $seen[mb_strtolower($t)] = true;
                $isCorrect = is_array($o) && !empty($o['is_correct']);
                $correct += $isCorrect ? 1 : 0;
                $opts[] = ['text' => $t, 'is_correct' => $isCorrect ? 1 : 0];
            }
            if ($bad) {
                $errors["q{$n}"] = "{$n}-savolda bo‘sh yoki takroriy javob varianti bor.";
                continue;
            }
            if ($correct !== 1) {
                $errors["q{$n}"] = "{$n}-savolda aynan bitta to‘g‘ri javob bo‘lishi kerak.";
                continue;
            }
            $clean[] = ['question' => $text, 'explanation' => $explanation === '' ? null : $explanation, 'options' => $opts];
        }
        if ($errors) {
            throw_validation(array_slice($errors, 0, 20, true), 'Ayrim savollar yaroqsiz.');
        }
        return $clean;
    }

    private static function insertQuestions(int $versionId, array $questions): void
    {
        $qStmt = db()->prepare('INSERT INTO questions (test_version_id, question_text, explanation, position) VALUES (?, ?, ?, ?)');
        $oStmt = db()->prepare('INSERT INTO question_options (question_id, option_text, is_correct, position) VALUES (?, ?, ?, ?)');
        foreach ($questions as $i => $q) {
            $qStmt->execute([$versionId, $q['question'], $q['explanation'], $i + 1]);
            $qid = (int) db()->lastInsertId();
            foreach ($q['options'] as $j => $o) {
                $oStmt->execute([$qid, $o['text'], $o['is_correct'], $j + 1]);
            }
        }
    }

    public static function create(int $userId, array $in): int
    {
        $meta = self::normalizeMeta($in, true);
        $questions = self::normalizeQuestions($in['questions'] ?? null);
        $filename = isset($in['source_filename']) ? basename(clean_text($in['source_filename'], 255, false)) : '';
        $pdo = db();
        $pdo->beginTransaction();
        try {
            db_exec(
                'INSERT INTO tests (user_id, title, subject, description, source_filename, current_version, question_count) VALUES (?, ?, ?, ?, ?, 1, ?)',
                [$userId, $meta['title'], $meta['subject'] ?? null, $meta['description'] ?? null, $filename === '' ? null : $filename, count($questions)]
            );
            $testId = (int) $pdo->lastInsertId();
            db_exec('INSERT INTO test_versions (test_id, version_number, question_count) VALUES (?, 1, ?)', [$testId, count($questions)]);
            $versionId = (int) $pdo->lastInsertId();
            self::insertQuestions($versionId, $questions);
            db_exec('INSERT INTO user_activity (user_id, activity_type, reference_id) VALUES (?, ?, ?)', [$userId, 'test_created', $testId]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        return $testId;
    }

    public static function addVersion(int $testId, int $userId, array $questionsInput): int
    {
        $questions = self::normalizeQuestions($questionsInput);
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $test = db_one('SELECT * FROM tests WHERE id = ? AND user_id = ? AND deleted_at IS NULL FOR UPDATE', [$testId, $userId]);
            if ($test === null) {
                throw new ApiException(404, 'Test topilmadi.');
            }
            $next = (int) $test['current_version'] + 1;
            db_exec('INSERT INTO test_versions (test_id, version_number, question_count) VALUES (?, ?, ?)', [$testId, $next, count($questions)]);
            $versionId = (int) $pdo->lastInsertId();
            self::insertQuestions($versionId, $questions);
            db_exec('UPDATE tests SET current_version = ?, question_count = ? WHERE id = ?', [$next, count($questions), $testId]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        return $next;
    }

    public static function currentVersionId(int $testId, int $version): int
    {
        return (int) db_value('SELECT id FROM test_versions WHERE test_id = ? AND version_number = ?', [$testId, $version]);
    }

    public static function formatTest(array $t): array
    {
        return [
            'id' => (int) $t['id'],
            'title' => $t['title'],
            'subject' => $t['subject'],
            'description' => $t['description'],
            'source_filename' => $t['source_filename'],
            'question_count' => (int) $t['question_count'],
            'current_version' => (int) $t['current_version'],
            'created_at' => $t['created_at'],
            'updated_at' => $t['updated_at'],
        ];
    }
}
