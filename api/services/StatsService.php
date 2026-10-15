<?php
declare(strict_types=1);

final class StatsService
{
    public static function mistakeIndex(int $uid, ?int $testId = null): array
    {
        $sql = "SELECT aq.id, aq.question_id, aq.selected_option_id, aq.is_correct, aq.answered_at, a.test_id
                FROM attempt_questions aq JOIN attempts a ON a.id = aq.attempt_id
                WHERE a.user_id = ? AND aq.answered_at IS NOT NULL AND (a.status = 'completed' OR a.mode = 'practice')"
            . ($testId !== null ? ' AND a.test_id = ?' : '') . "
                AND aq.question_id IN (
                    SELECT aq3.question_id FROM attempt_questions aq3 JOIN attempts a3 ON a3.id = aq3.attempt_id
                    WHERE a3.user_id = ? AND aq3.is_correct = 0 AND (a3.status = 'completed' OR a3.mode = 'practice'))
                ORDER BY aq.answered_at ASC, aq.id ASC";
        $params = $testId !== null ? [$uid, $testId, $uid] : [$uid, $uid];
        $index = [];
        foreach (db_all($sql, $params) as $r) {
            $qid = (int) $r['question_id'];
            $index[$qid] ??= ['question_id' => $qid, 'test_id' => (int) $r['test_id'], 'wrong_count' => 0, 'last_selected_option_id' => null, 'last_correct' => null, 'last_at' => null];
            if ((int) $r['is_correct'] === 0) {
                $index[$qid]['wrong_count']++;
            }
            $index[$qid]['last_selected_option_id'] = $r['selected_option_id'] === null ? null : (int) $r['selected_option_id'];
            $index[$qid]['last_correct'] = (int) $r['is_correct'] === 1;
            $index[$qid]['last_at'] = $r['answered_at'];
        }
        return $index;
    }

    public static function unresolvedQuestionIds(int $uid, int $testId): array
    {
        $ids = [];
        foreach (self::mistakeIndex($uid, $testId) as $qid => $m) {
            if ($m['last_correct'] === false) {
                $ids[] = $qid;
            }
        }
        return $ids;
    }

    private static function streak(int $uid): array
    {
        $rows = db_all(
            'SELECT DISTINCT DATE(aq.answered_at) AS d FROM attempt_questions aq JOIN attempts a ON a.id = aq.attempt_id
             WHERE a.user_id = ? AND aq.answered_at >= CURDATE() - INTERVAL 120 DAY ORDER BY d DESC',
            [$uid]
        );
        $days = array_column($rows, 'd');
        $today = date('Y-m-d');
        $cursor = in_array($today, $days, true) ? $today : date('Y-m-d', strtotime('-1 day'));
        $streak = 0;
        while (in_array($cursor, $days, true)) {
            $streak++;
            $cursor = date('Y-m-d', strtotime($cursor . ' -1 day'));
        }
        return ['streak' => $streak, 'studied_today' => in_array($today, $days, true)];
    }

    public static function overview(int $uid): array
    {
        $vis = "(a.status = 'completed' OR a.mode = 'practice')";
        $att = db_one("SELECT COUNT(*) AS completed, ROUND(AVG(CASE WHEN source = 'test' THEN percentage END)) AS avg_score, MAX(CASE WHEN source = 'test' THEN percentage END) AS best_score FROM attempts WHERE user_id = ? AND status = 'completed'", [$uid]);
        $ans = db_one(
            "SELECT COUNT(*) AS answered,
                    COALESCE(SUM(CASE WHEN {$vis} AND aq.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct,
                    COALESCE(SUM(CASE WHEN {$vis} AND aq.is_correct = 0 THEN 1 ELSE 0 END), 0) AS wrong
             FROM attempt_questions aq JOIN attempts a ON a.id = aq.attempt_id WHERE a.user_id = ? AND aq.answered_at IS NOT NULL",
            [$uid]
        );
        $testsCount = (int) db_value('SELECT COUNT(*) FROM tests WHERE user_id = ? AND deleted_at IS NULL', [$uid]);
        $bookmarks = (int) db_value('SELECT COUNT(*) FROM bookmarks WHERE user_id = ?', [$uid]);

        $recent = db_all(
            "SELECT a.id, a.test_id, t.title AS test_title, a.mode, a.source, a.percentage, a.correct_count, a.total_questions, a.completed_at
             FROM attempts a JOIN tests t ON t.id = a.test_id WHERE a.user_id = ? AND a.status = 'completed' ORDER BY a.completed_at DESC, a.id DESC LIMIT 5",
            [$uid]
        );
        $recentTests = db_all('SELECT id, title, subject, question_count, created_at FROM tests WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 5', [$uid]);
        $unfinished = db_all(
            "SELECT a.id, a.test_id, t.title AS test_title, a.mode, a.source, a.total_questions, a.started_at,
                    (SELECT COUNT(*) FROM attempt_questions x WHERE x.attempt_id = a.id AND x.selected_option_id IS NOT NULL) AS answered_count
             FROM attempts a JOIN tests t ON t.id = a.test_id WHERE a.user_id = ? AND a.status = 'in_progress' ORDER BY a.id DESC LIMIT 5",
            [$uid]
        );

        $weeklyRaw = db_all(
            "SELECT DATE(aq.answered_at) AS d, COUNT(*) AS answered,
                    SUM(CASE WHEN {$vis} AND aq.is_correct = 1 THEN 1 ELSE 0 END) AS correct,
                    SUM(CASE WHEN {$vis} AND aq.is_correct = 0 THEN 1 ELSE 0 END) AS wrong
             FROM attempt_questions aq JOIN attempts a ON a.id = aq.attempt_id
             WHERE a.user_id = ? AND aq.answered_at >= CURDATE() - INTERVAL 6 DAY GROUP BY DATE(aq.answered_at)",
            [$uid]
        );
        $byDay = [];
        foreach ($weeklyRaw as $w) {
            $byDay[$w['d']] = $w;
        }
        $weekly = [];
        for ($i = 6; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-{$i} day"));
            $w = $byDay[$d] ?? null;
            $weekly[] = ['date' => $d, 'answered' => (int) ($w['answered'] ?? 0), 'correct' => (int) ($w['correct'] ?? 0), 'wrong' => (int) ($w['wrong'] ?? 0)];
        }
        $todayAnswered = $weekly[6]['answered'];

        $weak = db_all(
            "SELECT w.id, w.title, w.correct, w.wrong FROM (
                SELECT t.id, t.title,
                       SUM(CASE WHEN aq.is_correct = 1 THEN 1 ELSE 0 END) AS correct,
                       SUM(CASE WHEN aq.is_correct = 0 THEN 1 ELSE 0 END) AS wrong
                FROM attempt_questions aq JOIN attempts a ON a.id = aq.attempt_id JOIN tests t ON t.id = a.test_id
                WHERE a.user_id = ? AND t.deleted_at IS NULL AND aq.is_correct IS NOT NULL AND {$vis}
                GROUP BY t.id, t.title) w
             WHERE (w.correct + w.wrong) >= 5 ORDER BY (w.correct / (w.correct + w.wrong)) ASC LIMIT 3",
            [$uid]
        );
        $weak = array_map(static fn($w) => [
            'test_id' => (int) $w['id'],
            'title' => $w['title'],
            'answered' => (int) $w['correct'] + (int) $w['wrong'],
            'accuracy' => (int) round(((int) $w['correct'] / ((int) $w['correct'] + (int) $w['wrong'])) * 100),
            'unresolved' => count(self::unresolvedQuestionIds($uid, (int) $w['id'])),
        ], $weak);

        $index = self::mistakeIndex($uid);
        $unresolved = count(array_filter($index, static fn($m) => $m['last_correct'] === false));

        $answered = (int) $ans['answered'];
        $graded = (int) $ans['correct'] + (int) $ans['wrong'];
        $streak = self::streak($uid);

        return [
            'totals' => [
                'tests' => $testsCount,
                'completed_attempts' => (int) $att['completed'],
                'average_score' => $att['avg_score'] === null ? null : (int) $att['avg_score'],
                'best_score' => $att['best_score'] === null ? null : (int) $att['best_score'],
                'questions_answered' => $answered,
                'correct' => (int) $ans['correct'],
                'incorrect' => (int) $ans['wrong'],
                'correct_rate' => $graded > 0 ? (int) round(((int) $ans['correct'] / $graded) * 100) : null,
                'bookmarks' => $bookmarks,
                'mistakes_total' => count($index),
                'mistakes_unresolved' => $unresolved,
                'mistakes_resolved' => count($index) - $unresolved,
                'today_answered' => $todayAnswered,
                'streak' => $streak['streak'],
                'studied_today' => $streak['studied_today'],
            ],
            'recent_attempts' => array_map(static fn($r) => [
                'id' => (int) $r['id'], 'test_id' => (int) $r['test_id'], 'test_title' => $r['test_title'], 'mode' => $r['mode'], 'source' => $r['source'],
                'percentage' => (int) $r['percentage'], 'correct_count' => (int) $r['correct_count'], 'total_questions' => (int) $r['total_questions'], 'completed_at' => $r['completed_at'],
            ], $recent),
            'recent_tests' => array_map(static fn($r) => ['id' => (int) $r['id'], 'title' => $r['title'], 'subject' => $r['subject'], 'question_count' => (int) $r['question_count'], 'created_at' => $r['created_at']], $recentTests),
            'unfinished' => array_map(static fn($r) => [
                'id' => (int) $r['id'], 'test_id' => (int) $r['test_id'], 'test_title' => $r['test_title'], 'mode' => $r['mode'], 'source' => $r['source'],
                'total_questions' => (int) $r['total_questions'], 'answered_count' => (int) $r['answered_count'], 'started_at' => $r['started_at'],
            ], $unfinished),
            'weekly' => $weekly,
            'weak_areas' => $weak,
        ];
    }

    public static function full(int $uid): array
    {
        $data = self::overview($uid);
        $history = db_all(
            "SELECT a.id, t.title AS test_title, a.percentage, a.completed_at FROM attempts a JOIN tests t ON t.id = a.test_id
             WHERE a.user_id = ? AND a.status = 'completed' AND a.source = 'test' ORDER BY a.completed_at DESC, a.id DESC LIMIT 20",
            [$uid]
        );
        $data['score_history'] = array_reverse(array_map(static fn($r) => ['id' => (int) $r['id'], 'test_title' => $r['test_title'], 'percentage' => (int) $r['percentage'], 'completed_at' => $r['completed_at']], $history));

        $dailyRaw = db_all("SELECT DATE(completed_at) AS d, COUNT(*) AS c FROM attempts WHERE user_id = ? AND status = 'completed' AND completed_at >= CURDATE() - INTERVAL 29 DAY GROUP BY DATE(completed_at)", [$uid]);
        $dailyMap = array_column($dailyRaw, 'c', 'd');
        $daily = [];
        for ($i = 29; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-{$i} day"));
            $daily[] = ['date' => $d, 'attempts' => (int) ($dailyMap[$d] ?? 0)];
        }
        $data['attempts_daily'] = $daily;

        $data['by_subject'] = array_map(static fn($r) => ['subject' => $r['subject'], 'attempts' => (int) $r['attempts'], 'average' => (int) $r['average']], db_all(
            "SELECT COALESCE(t.subject, 'Boshqa') AS subject, COUNT(*) AS attempts, ROUND(AVG(a.percentage)) AS average
             FROM attempts a JOIN tests t ON t.id = a.test_id WHERE a.user_id = ? AND a.status = 'completed' AND a.source = 'test'
             GROUP BY COALESCE(t.subject, 'Boshqa') ORDER BY average DESC",
            [$uid]
        ));
        $data['by_test'] = array_map(static fn($r) => ['test_id' => (int) $r['id'], 'title' => $r['title'], 'attempts' => (int) $r['attempts'], 'average' => (int) $r['average'], 'best' => (int) $r['best']], db_all(
            "SELECT t.id, t.title, COUNT(*) AS attempts, ROUND(AVG(a.percentage)) AS average, MAX(a.percentage) AS best
             FROM attempts a JOIN tests t ON t.id = a.test_id WHERE a.user_id = ? AND a.status = 'completed' AND a.source = 'test'
             GROUP BY t.id, t.title ORDER BY average DESC LIMIT 20",
            [$uid]
        ));
        return $data;
    }
}
