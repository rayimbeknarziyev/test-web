<?php
declare(strict_types=1);

final class StatsController
{
    public static function overview(): never
    {
        $uid = require_auth();
        ok(StatsService::full($uid));
    }

    public static function mistakes(): never
    {
        $uid = require_auth();
        $page = Request::int('page', 1, 1, 100000);
        $per = Request::int('per_page', 30, 1, 100);
        $index = array_values(StatsService::mistakeIndex($uid));
        usort($index, static fn($a, $b) => strcmp((string) $b['last_at'], (string) $a['last_at']));
        $total = count($index);
        $slice = array_slice($index, ($page - 1) * $per, $per);
        $groups = [];
        if ($slice) {
            $ids = array_column($slice, 'question_id');
            $ph = implode(',', array_fill(0, count($ids), '?'));
            $qs = db_all("SELECT q.id, q.question_text, t.id AS test_id, t.title FROM questions q JOIN test_versions v ON v.id = q.test_version_id JOIN tests t ON t.id = v.test_id WHERE q.id IN ({$ph}) AND t.user_id = ? AND t.deleted_at IS NULL", [...$ids, $uid]);
            $qMap = array_column($qs, null, 'id');
            $opts = db_all("SELECT id, question_id, option_text, is_correct FROM question_options WHERE question_id IN ({$ph})", $ids);
            $optMap = [];
            foreach ($opts as $o) {
                $optMap[(int) $o['id']] = $o;
            }
            $correctByQ = [];
            foreach ($opts as $o) {
                if ((int) $o['is_correct'] === 1) {
                    $correctByQ[(int) $o['question_id']] = $o['option_text'];
                }
            }
            $bm = array_column(db_all("SELECT id, question_id FROM bookmarks WHERE user_id = ? AND question_id IN ({$ph})", [$uid, ...$ids]), 'id', 'question_id');
            foreach ($slice as $m) {
                $q = $qMap[$m['question_id']] ?? null;
                if ($q === null) {
                    continue;
                }
                $tid = (int) $q['test_id'];
                $groups[$tid] ??= ['test_id' => $tid, 'title' => $q['title'], 'items' => []];
                $groups[$tid]['items'][] = [
                    'question_id' => $m['question_id'],
                    'text' => $q['question_text'],
                    'wrong_count' => $m['wrong_count'],
                    'resolved' => $m['last_correct'] === true,
                    'last_selected' => $m['last_selected_option_id'] !== null && isset($optMap[$m['last_selected_option_id']]) ? $optMap[$m['last_selected_option_id']]['option_text'] : null,
                    'correct_answer' => $correctByQ[$m['question_id']] ?? null,
                    'last_at' => $m['last_at'],
                    'bookmark_id' => isset($bm[$m['question_id']]) ? (int) $bm[$m['question_id']] : null,
                ];
            }
        }
        $unresolvedByTest = [];
        foreach (StatsService::mistakeIndex($uid) as $m) {
            if ($m['last_correct'] === false) {
                $unresolvedByTest[$m['test_id']] = ($unresolvedByTest[$m['test_id']] ?? 0) + 1;
            }
        }
        foreach ($groups as $tid => &$g) {
            $g['unresolved_count'] = $unresolvedByTest[$tid] ?? 0;
        }
        unset($g);
        ok(['groups' => array_values($groups), 'total' => $total, 'page' => $page, 'per_page' => $per]);
    }
}
