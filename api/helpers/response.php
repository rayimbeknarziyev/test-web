<?php
declare(strict_types=1);

final class ApiException extends RuntimeException
{
    public function __construct(public readonly int $status, string $message, public readonly array $errors = [])
    {
        parent::__construct($message);
    }
}

function respond(int $status, array $payload): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function ok(mixed $data = null, string $message = 'Success', int $status = 200): never
{
    respond($status, ['success' => true, 'data' => $data, 'message' => $message]);
}

function fail(int $status, string $message, array $errors = []): never
{
    respond($status, ['success' => false, 'data' => null, 'message' => $message, 'errors' => (object) $errors]);
}

final class Request
{
    public static function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    public static function path(): string
    {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $pos = strpos($path, '/api');
        $path = $pos === false ? $path : substr($path, $pos + 4);
        $path = rtrim($path, '/');
        return $path === '' ? '/' : $path;
    }

    public static function json(): array
    {
        $max = 8 * 1024 * 1024;
        $raw = file_get_contents('php://input', false, null, 0, $max + 1);
        if ($raw === false || $raw === '') {
            return [];
        }
        if (strlen($raw) > $max) {
            throw new ApiException(413, 'So‘rov hajmi juda katta.');
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            throw new ApiException(400, 'JSON formati noto‘g‘ri.');
        }
        return $data;
    }

    public static function int(string $key, int $default, int $min, int $max): int
    {
        $value = filter_var($_GET[$key] ?? null, FILTER_VALIDATE_INT);
        if ($value === false || $value === null) {
            return $default;
        }
        return max($min, min($max, $value));
    }

    public static function str(string $key, int $maxLen = 100): string
    {
        $value = $_GET[$key] ?? '';
        if (!is_string($value)) {
            return '';
        }
        return mb_substr(trim($value), 0, $maxLen);
    }

    public static function ip(): string
    {
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}

function secure_shuffle(array $items): array
{
    $items = array_values($items);
    for ($i = count($items) - 1; $i > 0; $i--) {
        $j = random_int(0, $i);
        [$items[$i], $items[$j]] = [$items[$j], $items[$i]];
    }
    return $items;
}

function path_id(array $params, string $key = 'id'): int
{
    $id = (int) ($params[$key] ?? 0);
    if ($id < 1) {
        throw new ApiException(404, 'Topilmadi.');
    }
    return $id;
}
