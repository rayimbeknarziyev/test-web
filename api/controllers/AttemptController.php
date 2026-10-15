<?php
declare(strict_types=1);

final class AttemptController
{
    public static function create(array $p): never
    {
        $uid = require_auth();
        $id = AttemptService::create($uid, path_id($p), Request::json());
        ok(['attempt_id' => $id], 'Urinish boshlandi.', 201);
    }

    public static function index(): never
    {
        $uid = require_auth();
        ok(AttemptService::listFor($uid, Request::str('status', 20), Request::int('page', 1, 1, 100000), Request::int('per_page', 20, 1, 50)));
    }

    public static function show(array $p): never
    {
        $uid = require_auth();
        ok(AttemptService::state(path_id($p), $uid));
    }

    public static function resume(array $p): never
    {
        $uid = require_auth();
        $state = AttemptService::state(path_id($p), $uid);
        if ($state['attempt']['status'] !== 'in_progress') {
            throw new ApiException(409, 'Bu urinish allaqachon yakunlangan.');
        }
        ok($state);
    }

    public static function answer(array $p): never
    {
        $uid = require_auth();
        ok(AttemptService::answer(path_id($p), $uid, Request::json()), 'Javob saqlandi.');
    }

    public static function progress(array $p): never
    {
        $uid = require_auth();
        ok(AttemptService::progress(path_id($p), $uid, Request::json()));
    }

    public static function finish(array $p): never
    {
        $uid = require_auth();
        ok(['attempt' => AttemptService::finish(path_id($p), $uid)], 'Test yakunlandi.');
    }

    public static function review(array $p): never
    {
        $uid = require_auth();
        ok(['questions' => AttemptService::review(path_id($p), $uid)]);
    }

    public static function report(array $p): never
    {
        $uid = require_auth();
        $id = path_id($p);
        $attempt = AttemptService::findOwned($id, $uid);
        if ($attempt['status'] !== 'completed') {
            throw new ApiException(409, 'Hisobot faqat yakunlangan urinish uchun mavjud.');
        }
        $state = AttemptService::state($id, $uid);
        $user = db_one('SELECT name FROM users WHERE id = ?', [$uid]);
        $data = ['attempt' => $state['attempt'], 'student' => $user['name'] ?? '', 'generated_at' => date('Y-m-d H:i:s'), 'review' => null];
        if (($_GET['review'] ?? '') === '1') {
            $data['review'] = AttemptService::review($id, $uid);
        }
        ok($data);
    }
}
