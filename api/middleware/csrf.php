<?php
declare(strict_types=1);

function csrf_token(): string
{
    if (empty($_SESSION['csrf']) || !is_string($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function allowed_origins(): array
{
    $list = array_filter(array_map('trim', explode(',', (string) cfg('ALLOWED_ORIGINS', ''))));
    return array_values($list);
}

function apply_cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, allowed_origins(), true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
        header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
        header('Vary: Origin');
    }
}

function origin_allowed(): bool
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return true;
    }
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($origin === 'http://' . $host || $origin === 'https://' . $host) {
        return true;
    }
    return in_array($origin, allowed_origins(), true);
}

function verify_csrf(): void
{
    if (in_array(Request::method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
        return;
    }
    if (!origin_allowed()) {
        throw new ApiException(403, 'So‘rov manbasi ruxsat etilmagan.');
    }
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($sent) || $sent === '' || !hash_equals(csrf_token(), $sent)) {
        throw new ApiException(403, 'Xavfsizlik tokeni yaroqsiz. Sahifani yangilang.');
    }
}
