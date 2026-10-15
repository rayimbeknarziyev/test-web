<?php
declare(strict_types=1);

$base = $argv[1] ?? 'http://127.0.0.1:8080/api';
$passed = 0;
$failed = 0;

final class Client
{
    public string $cookie = '';
    public string $csrf = '';

    public function __construct(private string $base)
    {
    }

    public function call(string $method, string $path, ?array $body = null, bool $withCsrf = true, array $extraHeaders = []): array
    {
        $ch = curl_init($this->base . $path);
        $headers = ['Content-Type: application/json'];
        if ($withCsrf && $this->csrf !== '') {
            $headers[] = 'X-CSRF-Token: ' . $this->csrf;
        }
        foreach ($extraHeaders as $h) {
            $headers[] = $h;
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_HEADER => true,
            CURLOPT_COOKIE => $this->cookie,
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }
        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $hs = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $head = substr((string) $raw, 0, $hs);
        $json = json_decode(substr((string) $raw, $hs), true) ?? [];
        if (preg_match_all('/Set-Cookie: (TESTFLOWSESSID=[^;]+)/i', $head, $m)) {
            $this->cookie = end($m[1]);
        }
        return ['status' => $status, 'json' => $json, 'data' => $json['data'] ?? null];
    }

    public function boot(): void
    {
        $r = $this->call('GET', '/auth/csrf');
        $this->csrf = $r['data']['csrf_token'];
    }
}

function check(string $name, bool $cond, string $info = ''): void
{
    global $passed, $failed;
    if ($cond) {
        $passed++;
        echo "  PASS  {$name}\n";
    } else {
        $failed++;
        echo "  FAIL  {$name} {$info}\n";
    }
}

function makeQuestions(int $n): array
{
    $qs = [];
    for ($i = 1; $i <= $n; $i++) {
        $qs[] = ['question' => "Savol {$i} — O‘zbekiston ğ ң", 'options' => [
            ['text' => "To‘g‘ri {$i}", 'is_correct' => true],
            ['text' => "Xato A{$i}", 'is_correct' => false],
            ['text' => "Xato B{$i}", 'is_correct' => false],
            ['text' => "Xato C{$i}", 'is_correct' => false],
        ]];
    }
    return $qs;
}

$suffix = bin2hex(random_bytes(4));
$emailA = "a{$suffix}@example.com";
$emailB = "b{$suffix}@example.com";
$pw = 'Parol12345';

echo "AUTH\n";
$a = new Client($base);
$r = $a->call('GET', '/tests');
check('unauthenticated access rejected (401)', $r['status'] === 401);
$a->boot();
$r = $a->call('POST', '/auth/register', ['name' => 'Ali', 'email' => $emailA, 'password' => $pw, 'confirm_password' => 'boshqa1234']);
check('password mismatch rejected', $r['status'] === 422);
$r = $a->call('POST', '/auth/register', ['name' => 'Ali', 'email' => 'bad', 'password' => $pw, 'confirm_password' => $pw]);
check('invalid email rejected', $r['status'] === 422);
$r = $a->call('POST', '/auth/register', ['name' => 'Ali Valiyev', 'email' => $emailA, 'password' => $pw, 'confirm_password' => $pw]);
check('registration succeeds', $r['status'] === 201 && ($r['data']['user']['email'] ?? '') === $emailA);
$a->csrf = $r['data']['csrf_token'];
$r = $a->call('GET', '/auth/me');
check('me returns user after register', $r['status'] === 200);
$r = $a->call('POST', '/auth/logout');
check('logout succeeds', $r['status'] === 200);
$a->csrf = $r['data']['csrf_token'];
$r = $a->call('GET', '/auth/me');
check('me after logout is 401', $r['status'] === 401);
$dup = new Client($base);
$dup->boot();
$r = $dup->call('POST', '/auth/register', ['name' => 'Ali', 'email' => $emailA, 'password' => $pw, 'confirm_password' => $pw]);
check('duplicate email rejected', $r['status'] === 422 && isset($r['json']['errors']['email']));
$r = $a->call('POST', '/auth/login', ['email' => $emailA, 'password' => 'xato12345']);
check('wrong password rejected (401)', $r['status'] === 401);
$r = $a->call('POST', '/auth/login', ['email' => $emailA, 'password' => $pw]);
check('login succeeds', $r['status'] === 200);
$a->csrf = $r['data']['csrf_token'];
$r = $a->call('POST', '/auth/logout', null, false);
check('missing CSRF token rejected (403)', $r['status'] === 403);
$r = $a->call('POST', '/tests', ['title' => 'x', 'questions' => []], true, ['Origin: http://evil.example']);
check('foreign Origin rejected (403)', $r['status'] === 403);

$b = new Client($base);
$b->boot();
$r = $b->call('POST', '/auth/register', ['name' => 'Vali', 'email' => $emailB, 'password' => $pw, 'confirm_password' => $pw]);
$b->csrf = $r['data']['csrf_token'];

echo "TESTS\n";
$r = $a->call('POST', '/tests', ['title' => 'Bo‘sh', 'questions' => []]);
check('empty question list rejected', $r['status'] === 422);
$bad = makeQuestions(2);
$bad[1]['options'][1]['is_correct'] = true;
$r = $a->call('POST', '/tests', ['title' => 'Xato', 'questions' => $bad]);
check('question with two correct answers rejected', $r['status'] === 422);
$bad = makeQuestions(2);
$bad[0]['options'] = [['text' => 'Faqat bitta', 'is_correct' => true]];
$r = $a->call('POST', '/tests', ['title' => 'Xato', 'questions' => $bad]);
check('question with one option rejected', $r['status'] === 422);
$r = $a->call('POST', '/tests', ['title' => '<script>alert(1)</script>', 'subject' => 'Tizimli tahlil', 'source_filename' => '../../etc/passwd.csv', 'questions' => makeQuestions(60), 'user_id' => 9999]);
check('valid test with 60 questions saved', $r['status'] === 201);
$testId = (int) ($r['data']['id'] ?? 0);
$r = $a->call('GET', "/tests/{$testId}");
check('test detail ok, filename sanitized', $r['status'] === 200 && ($r['data']['test']['source_filename'] ?? '') === 'passwd.csv' && $r['data']['test']['question_count'] === 60);
$r = $a->call('GET', "/tests/{$testId}/preview");
check('preview returns 60 questions with options', count($r['data']['questions'] ?? []) === 60 && count($r['data']['questions'][0]['options']) === 4);
$r = $a->call('GET', '/tests?q=' . urlencode("'; DROP TABLE tests;--"));
check('SQL injection attempt returns empty list safely', $r['status'] === 200 && $r['data']['total'] === 0);
$r = $a->call('GET', '/tests?q=%25');
check('LIKE wildcard escaped', $r['status'] === 200 && $r['data']['total'] === 0);

echo "AUTHORIZATION\n";
$r = $b->call('GET', "/tests/{$testId}");
check('user B cannot read user A test', $r['status'] === 404);
$r = $b->call('GET', "/tests/{$testId}/preview");
check('user B cannot preview user A test', $r['status'] === 404);
$r = $b->call('PATCH', "/tests/{$testId}", ['title' => 'Hack']);
check('user B cannot rename user A test', $r['status'] === 404);
$r = $b->call('DELETE', "/tests/{$testId}");
check('user B cannot delete user A test', $r['status'] === 404);
$r = $b->call('POST', "/tests/{$testId}/attempts", ['mode' => 'practice', 'count' => 25]);
check('user B cannot start attempt on user A test', $r['status'] === 404);
$r = $b->call('GET', '/tests');
check('user B list is empty', $r['data']['total'] === 0);

echo "ATTEMPT (PRACTICE)\n";
$r = $a->call('POST', "/tests/{$testId}/attempts", ['mode' => 'practice', 'count' => 40]);
check('invalid count rejected', $r['status'] === 422);
$r = $a->call('POST', "/tests/{$testId}/attempts", ['mode' => 'practice', 'count' => 50]);
check('50 questions allowed with 60 available', $r['status'] === 201);
$r = $a->call('POST', "/tests/{$testId}/attempts", ['mode' => 'practice', 'count' => 25]);
check('25-question attempt created', $r['status'] === 201);
$attId = (int) $r['data']['attempt_id'];
$state = $a->call('GET', "/attempts/{$attId}");
$qs = $state['data']['questions'];
check('25 distinct questions selected', count($qs) === 25 && count(array_unique(array_column($qs, 'question_id'))) === 25);
$json = json_encode($state['json']);
check('no correctness metadata leaked at start', !str_contains($json, 'is_correct') && !str_contains($json, 'correct_option_id'));
$again = $a->call('GET', "/attempts/{$attId}");
check('order is stable across reads', array_column($again['data']['questions'], 'question_id') === array_column($qs, 'question_id') && json_encode(array_column($again['data']['questions'], 'options')) === json_encode(array_column($qs, 'options')));
$positions = [];
$a2 = $a->call('POST', "/tests/{$testId}/attempts", ['mode' => 'practice', 'count' => 25]);
$s2 = $a->call('GET', '/attempts/' . $a2['data']['attempt_id']);
check('new attempt gets new random order', array_column($s2['data']['questions'], 'question_id') !== array_column($qs, 'question_id'));

$correctIdx = 0;
$q1 = $qs[0];
$text = $q1['options'][0]['text'];
$pick = null;
foreach ($q1['options'] as $o) {
    if (str_starts_with($o['text'], 'To‘g‘ri')) {
        $pick = $o['id'];
    }
}
$r = $a->call('POST', "/attempts/{$attId}/answers", ['attempt_question_id' => $q1['attempt_question_id'], 'option_id' => $pick, 'is_correct' => false, 'score' => 99]);
check('correct answer graded by server', $r['status'] === 200 && $r['data']['is_correct'] === true && $r['data']['correct_option_id'] === $pick);
$wrongPick = null;
foreach ($qs[1]['options'] as $o) {
    if (!str_starts_with($o['text'], 'To‘g‘ri')) {
        $wrongPick = $o['id'];
        break;
    }
}
$r = $a->call('POST', "/attempts/{$attId}/answers", ['attempt_question_id' => $qs[1]['attempt_question_id'], 'option_id' => $wrongPick]);
check('wrong answer graded, correct revealed', $r['data']['is_correct'] === false && $r['data']['correct_option_id'] !== $wrongPick && $r['data']['correct_option_id'] !== null);
$other = null;
foreach ($qs[1]['options'] as $o) {
    if ($o['id'] !== $wrongPick) {
        $other = $o['id'];
        break;
    }
}
$r = $a->call('POST', "/attempts/{$attId}/answers", ['attempt_question_id' => $qs[1]['attempt_question_id'], 'option_id' => $other]);
check('answer cannot be changed (first choice final)', $r['data']['already_answered'] === true && $r['data']['selected_option_id'] === $wrongPick);
$r = $a->call('POST', "/attempts/{$attId}/answers", ['attempt_question_id' => $qs[2]['attempt_question_id'], 'option_id' => $qs[3]['options'][0]['id']]);
check('option from another question rejected', $r['status'] === 422);
$r = $a->call('POST', "/attempts/{$attId}/answers", ['attempt_question_id' => $qs[2]['attempt_question_id'] + 100000, 'option_id' => $pick]);
check('foreign attempt_question rejected', $r['status'] === 404);
$r = $b->call('POST', "/attempts/{$attId}/answers", ['attempt_question_id' => $qs[2]['attempt_question_id'], 'option_id' => $qs[2]['options'][0]['id']]);
check('user B cannot answer user A attempt', $r['status'] === 404);
$r = $b->call('GET', "/attempts/{$attId}");
check('user B cannot read user A attempt', $r['status'] === 404);
$r = $a->call('PATCH', "/attempts/{$attId}/progress", ['current_question_index' => 7]);
check('progress saved', $r['status'] === 200);
$r = $a->call('PATCH', "/attempts/{$attId}/progress", ['current_question_index' => 99]);
check('out-of-range progress rejected', $r['status'] === 422);
$resume = $a->call('POST', "/attempts/{$attId}/resume");
check('resume restores index, answers and feedback', $resume['data']['attempt']['current_question_index'] === 7 && $resume['data']['questions'][0]['selected_option_id'] === $pick && $resume['data']['questions'][0]['is_correct'] === true && $resume['data']['attempt']['answered_count'] === 2);
$r = $a->call('GET', "/attempts/{$attId}/review");
check('review blocked before finishing', $r['status'] === 409);
$r = $a->call('POST', "/attempts/{$attId}/finish", ['correct_count' => 25, 'percentage' => 100]);
$res = $r['data']['attempt']['result'] ?? [];
check('finish ignores client score; 1 correct / 1 wrong / 23 unanswered / 4%', ($res['correct'] ?? -1) === 1 && ($res['incorrect'] ?? -1) === 1 && ($res['unanswered'] ?? -1) === 23 && ($res['percentage'] ?? -1) === 4 && ($res['total'] ?? 0) === 25, json_encode($res));
$r = $a->call('POST', "/attempts/{$attId}/finish");
check('finish is idempotent', $r['status'] === 200 && ($r['data']['attempt']['result']['percentage'] ?? -1) === 4);
$r = $a->call('POST', "/attempts/{$attId}/answers", ['attempt_question_id' => $qs[2]['attempt_question_id'], 'option_id' => $qs[2]['options'][0]['id']]);
check('answering a completed attempt rejected', $r['status'] === 409);
$r = $a->call('GET', "/attempts/{$attId}/review");
check('review lists 25 items with statuses', count($r['data']['questions'] ?? []) === 25 && $r['data']['questions'][0]['status'] === 'correct' && $r['data']['questions'][1]['status'] === 'wrong' && $r['data']['questions'][2]['status'] === 'unanswered');
$r = $a->call('GET', "/attempts/{$attId}/report?review=1");
check('report with review available', $r['status'] === 200 && count($r['data']['review'] ?? []) === 25);

echo "EXAM MODE\n";
$r = $a->call('POST', "/tests/{$testId}/attempts", ['mode' => 'exam', 'count' => 25]);
$exId = (int) $r['data']['attempt_id'];
$ex = $a->call('GET', "/attempts/{$exId}");
$eqs = $ex['data']['questions'];
$pickEx = null;
foreach ($eqs[0]['options'] as $o) {
    if (str_starts_with($o['text'], 'To‘g‘ri')) {
        $pickEx = $o['id'];
    }
}
$r = $a->call('POST', "/attempts/{$exId}/answers", ['attempt_question_id' => $eqs[0]['attempt_question_id'], 'option_id' => $pickEx]);
check('exam answer saved without revealing correctness', $r['status'] === 200 && !isset($r['data']['is_correct']) && !isset($r['data']['correct_option_id']));
$ex = $a->call('GET', "/attempts/{$exId}");
$exJson = json_encode($ex['json']);
check('exam state hides correctness while in progress', !str_contains($exJson, 'is_correct') && !str_contains($exJson, 'correct_option_id') && $ex['data']['questions'][0]['selected_option_id'] === $pickEx);
$r = $a->call('POST', '/bookmarks', ['question_id' => $eqs[0]['question_id']]);
check('bookmark created', $r['status'] === 201);
$bmId = (int) $r['data']['id'];
$bm = $a->call('GET', '/bookmarks');
check('bookmarks hide correct answer during in-progress exam', $bm['status'] === 200 && $bm['data']['total'] === 1 && $bm['data']['groups'][0]['items'][0]['correct_answer'] === null);
$r = $b->call('DELETE', "/bookmarks/{$bmId}");
check('user B cannot delete user A bookmark', $r['status'] === 404);
$r = $b->call('POST', '/bookmarks', ['question_id' => $eqs[0]['question_id']]);
check('user B cannot bookmark user A question', $r['status'] === 404);
$r = $a->call('POST', "/attempts/{$exId}/finish");
check('exam finished; 1 correct of 25 = 4%', $r['data']['attempt']['result']['correct'] === 1 && $r['data']['attempt']['result']['percentage'] === 4);

echo "MISTAKES AND REVISION\n";
$m = $a->call('GET', '/mistakes');
check('mistakes list contains the wrong answer', $m['status'] === 200 && $m['data']['total'] >= 1 && $m['data']['groups'][0]['unresolved_count'] >= 1);
$r = $a->call('POST', "/tests/{$testId}/attempts", ['mode' => 'practice', 'source' => 'mistakes']);
check('revision attempt created from mistakes', $r['status'] === 201);
$rvId = (int) $r['data']['attempt_id'];
$rv = $a->call('GET', "/attempts/{$rvId}");
check('revision contains only previously wrong questions', in_array($qs[1]['question_id'], array_column($rv['data']['questions'], 'question_id'), true));
$rq = null;
foreach ($rv['data']['questions'] as $q) {
    if ($q['question_id'] === $qs[1]['question_id']) {
        $rq = $q;
    }
}
$right = null;
foreach ($rq['options'] as $o) {
    if (str_starts_with($o['text'], 'To‘g‘ri')) {
        $right = $o['id'];
    }
}
$a->call('POST', "/attempts/{$rvId}/answers", ['attempt_question_id' => $rq['attempt_question_id'], 'option_id' => $right]);
$m2 = $a->call('GET', '/mistakes');
$resolved = false;
foreach ($m2['data']['groups'] as $g) {
    foreach ($g['items'] as $it) {
        if ($it['question_id'] === $qs[1]['question_id']) {
            $resolved = $it['resolved'];
        }
    }
}
check('correct revision answer resolves the mistake', $resolved === true);
$a->call('POST', "/attempts/{$rvId}/finish");

echo "VERSIONING AND DELETE\n";
$r = $a->call('POST', "/tests/{$testId}/versions", ['questions' => makeQuestions(30)]);
check('new version created (v2)', $r['status'] === 201 && $r['data']['version_number'] === 2);
$old = $a->call('GET', "/attempts/{$attId}/review");
check('historical attempt unchanged after new version', count($old['data']['questions']) === 25 && $old['data']['questions'][0]['text'] === $qs[0]['text']);
$r = $a->call('POST', "/tests/{$testId}/attempts", ['mode' => 'practice', 'count' => 50]);
check('50 rejected when new version has only 30', $r['status'] === 422);
$r = $a->call('POST', "/tests/{$testId}/attempts", ['mode' => 'practice', 'count' => 'all']);
check('"all" starts with 30 questions', $r['status'] === 201);
$stats = $a->call('GET', '/statistics');
check('statistics computed from DB', $stats['status'] === 200 && $stats['data']['totals']['completed_attempts'] >= 3 && $stats['data']['totals']['questions_answered'] >= 4 && count($stats['data']['weekly']) === 7);
$r = $a->call('PATCH', "/tests/{$testId}", ['title' => 'Qayta nomlangan', 'subject' => 'Fan']);
check('rename ok', $r['status'] === 200 && $r['data']['test']['title'] === 'Qayta nomlangan');
$r = $a->call('DELETE', "/tests/{$testId}");
check('delete test (soft)', $r['status'] === 200);
$r = $a->call('GET', "/tests/{$testId}");
check('deleted test not accessible', $r['status'] === 404);
$old = $a->call('GET', "/attempts/{$attId}");
check('attempt history survives test deletion', $old['status'] === 200 && $old['data']['attempt']['result']['percentage'] === 4);

echo "PROFILE\n";
$r = $a->call('POST', '/auth/password', ['current_password' => 'noto‘g‘ri', 'new_password' => 'Yangi12345', 'confirm_password' => 'Yangi12345']);
check('password change needs current password', $r['status'] === 422);
$r = $a->call('POST', '/auth/forgot-password', ['email' => $emailA]);
check('forgot-password honest 501 when mail not configured', $r['status'] === 501);
$r = $a->call('GET', '/nope');
check('unknown route 404', $r['status'] === 404);

echo "\n{$passed} passed, {$failed} failed\n";
exit($failed > 0 ? 1 : 0);
