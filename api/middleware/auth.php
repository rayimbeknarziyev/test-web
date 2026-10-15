<?php
declare(strict_types=1);

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $lifetime = (int) cfg('SESSION_LIFETIME', 604800);
    session_name('TESTFLOWSESSID');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string) $lifetime);
    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path' => '/',
        'secure' => is_production() || $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
    if (isset($_SESSION['last_activity']) && time() - (int) $_SESSION['last_activity'] > $lifetime) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    if (!empty($_SESSION['user_id'])) {
        $_SESSION['last_activity'] = time();
    }
}

function current_user_id(): ?int
{
    $id = $_SESSION['user_id'] ?? null;
    return is_int($id) && $id > 0 ? $id : null;
}

function require_auth(): int
{
    $id = current_user_id();
    if ($id === null) {
        throw new ApiException(401, 'Tizimga kirish talab qilinadi.');
    }
    return $id;
}

function login_session(int $userId): void
{
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    $_SESSION['last_activity'] = time();
}

function destroy_session(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Lax']);
    }
    session_destroy();
}
