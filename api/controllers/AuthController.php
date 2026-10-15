<?php
declare(strict_types=1);

final class AuthController
{
    private static function publicUser(?int $id): ?array
    {
        if ($id === null) {
            return null;
        }
        $u = db_one('SELECT id, name, email, created_at FROM users WHERE id = ?', [$id]);
        return $u === null ? null : ['id' => (int) $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'created_at' => $u['created_at']];
    }

    public static function csrf(): never
    {
        $user = self::publicUser(current_user_id());
        if ($user === null && current_user_id() !== null) {
            destroy_session();
            start_session();
        }
        ok(['csrf_token' => csrf_token(), 'user' => $user]);
    }

    public static function register(): never
    {
        RateLimiter::hit('register', Request::ip(), 10, 3600);
        $in = Request::json();
        $errors = [];
        $name = clean_text($in['name'] ?? '', 120, false);
        if (mb_strlen($name) < 2) {
            $errors['name'] = 'Ism kamida 2 ta belgidan iborat bo‘lishi kerak.';
        }
        $email = validate_email_value($in['email'] ?? '');
        if ($email === null) {
            $errors['email'] = 'Email manzili noto‘g‘ri.';
        }
        $problem = password_problem($in['password'] ?? '');
        if ($problem !== null) {
            $errors['password'] = $problem;
        } elseif (($in['password'] ?? '') !== ($in['confirm_password'] ?? null)) {
            $errors['confirm_password'] = 'Parollar mos kelmadi.';
        }
        if ($errors) {
            throw_validation($errors);
        }
        if (db_one('SELECT id FROM users WHERE email = ?', [$email]) !== null) {
            throw_validation(['email' => 'Bu email allaqachon ro‘yxatdan o‘tgan.']);
        }
        try {
            db_exec('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [$name, $email, password_hash($in['password'], PASSWORD_DEFAULT)]);
        } catch (PDOException $e) {
            if (($e->errorInfo[1] ?? 0) === 1062) {
                throw_validation(['email' => 'Bu email allaqachon ro‘yxatdan o‘tgan.']);
            }
            throw $e;
        }
        $id = (int) db()->lastInsertId();
        login_session($id);
        ok(['user' => self::publicUser($id), 'csrf_token' => csrf_token()], 'Ro‘yxatdan o‘tdingiz.', 201);
    }

    public static function login(): never
    {
        $in = Request::json();
        $email = validate_email_value($in['email'] ?? '');
        $password = is_string($in['password'] ?? null) ? $in['password'] : '';
        if ($email === null || $password === '') {
            throw_validation(['email' => 'Email va parolni kiriting.']);
        }
        $subject = Request::ip() . '|' . $email;
        RateLimiter::hit('login', $subject, 8, 900);
        $user = db_one('SELECT id, password_hash FROM users WHERE email = ?', [$email]);
        $hash = $user['password_hash'] ?? '$2y$10$usesomesillystringforsaltandhashingxxxxxxxxxxxxxxxxxxxxxxx';
        $valid = password_verify($password, $hash);
        if ($user === null || !$valid) {
            throw new ApiException(401, 'Email yoki parol noto‘g‘ri.');
        }
        RateLimiter::reset('login', $subject);
        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            db_exec('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $user['id']]);
        }
        login_session((int) $user['id']);
        ok(['user' => self::publicUser((int) $user['id']), 'csrf_token' => csrf_token()], 'Xush kelibsiz!');
    }

    public static function logout(): never
    {
        destroy_session();
        start_session();
        ok(['csrf_token' => csrf_token()], 'Tizimdan chiqdingiz.');
    }

    public static function me(): never
    {
        $user = self::publicUser(require_auth());
        if ($user === null) {
            throw new ApiException(401, 'Tizimga kirish talab qilinadi.');
        }
        ok(['user' => $user]);
    }

    public static function profile(): never
    {
        $uid = require_auth();
        $name = clean_text(Request::json()['name'] ?? '', 120, false);
        if (mb_strlen($name) < 2) {
            throw_validation(['name' => 'Ism kamida 2 ta belgidan iborat bo‘lishi kerak.']);
        }
        db_exec('UPDATE users SET name = ? WHERE id = ?', [$name, $uid]);
        ok(['user' => self::publicUser($uid)], 'Profil yangilandi.');
    }

    public static function password(): never
    {
        $uid = require_auth();
        RateLimiter::hit('password', (string) $uid, 10, 3600);
        $in = Request::json();
        $row = db_one('SELECT password_hash FROM users WHERE id = ?', [$uid]);
        if ($row === null || !is_string($in['current_password'] ?? null) || !password_verify($in['current_password'], $row['password_hash'])) {
            throw_validation(['current_password' => 'Joriy parol noto‘g‘ri.']);
        }
        $problem = password_problem($in['new_password'] ?? '');
        if ($problem !== null) {
            throw_validation(['new_password' => $problem]);
        }
        if (($in['new_password'] ?? '') !== ($in['confirm_password'] ?? null)) {
            throw_validation(['confirm_password' => 'Parollar mos kelmadi.']);
        }
        db_exec('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($in['new_password'], PASSWORD_DEFAULT), $uid]);
        session_regenerate_id(true);
        ok(null, 'Parol yangilandi.');
    }

    public static function forgot(): never
    {
        if (cfg('MAIL_ENABLED', 'false') !== 'true') {
            throw new ApiException(501, 'Email yuborish sozlanmagan. Parolni tiklash uchun administrator bilan bog‘laning.');
        }
        RateLimiter::hit('forgot', Request::ip(), 5, 3600);
        $email = validate_email_value(Request::json()['email'] ?? '');
        if ($email !== null) {
            $user = db_one('SELECT id FROM users WHERE email = ?', [$email]);
            if ($user !== null) {
                $token = bin2hex(random_bytes(32));
                db_exec('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, NOW() + INTERVAL 1 HOUR)', [$user['id'], hash('sha256', $token)]);
                $link = rtrim((string) cfg('APP_URL', ''), '/') . '/pages/forgot.html?token=' . $token;
                @mail($email, 'TestFlow: parolni tiklash', "Parolni tiklash havolasi (1 soat amal qiladi):\n" . $link, 'From: ' . cfg('MAIL_FROM', 'no-reply@localhost'));
            }
        }
        ok(null, 'Agar bu email ro‘yxatdan o‘tgan bo‘lsa, tiklash havolasi yuborildi.');
    }

    public static function reset(): never
    {
        if (cfg('MAIL_ENABLED', 'false') !== 'true') {
            throw new ApiException(501, 'Email yuborish sozlanmagan.');
        }
        RateLimiter::hit('reset', Request::ip(), 10, 3600);
        $in = Request::json();
        $problem = password_problem($in['password'] ?? '');
        if ($problem !== null) {
            throw_validation(['password' => $problem]);
        }
        if (($in['password'] ?? '') !== ($in['confirm_password'] ?? null)) {
            throw_validation(['confirm_password' => 'Parollar mos kelmadi.']);
        }
        $token = is_string($in['token'] ?? null) ? $in['token'] : '';
        $row = db_one('SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()', [hash('sha256', $token)]);
        if ($row === null) {
            throw new ApiException(400, 'Havola yaroqsiz yoki muddati tugagan.');
        }
        $pdo = db();
        $pdo->beginTransaction();
        db_exec('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($in['password'], PASSWORD_DEFAULT), $row['user_id']]);
        db_exec('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [$row['id']]);
        $pdo->commit();
        ok(null, 'Parol yangilandi. Endi tizimga kirishingiz mumkin.');
    }
}
