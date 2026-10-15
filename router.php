<?php
declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = rawurldecode($path);

if (preg_match('#^/(\.env|testflow\.env|storage/|database/|tests/|api/(config|services|controllers|helpers|middleware|routes)/|api/bootstrap\.php)#', $path)) {
    http_response_code(403);
    exit;
}

if (str_starts_with($path, '/api/') || $path === '/api') {
    require __DIR__ . '/api/index.php';
    return true;
}

$file = __DIR__ . $path;
if ($path === '/' ) {
    return false;
}
if (is_file($file)) {
    return false;
}
http_response_code(404);
echo 'Not found';
return true;
