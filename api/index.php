<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$routes = [];

function route(string $method, string $pattern, callable $handler): void
{
    global $routes;
    $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>\d+)', $pattern) . '$#';
    $routes[] = [$method, $regex, $handler];
}

foreach (['auth', 'tests', 'attempts', 'statistics', 'bookmarks', 'export'] as $file) {
    require __DIR__ . '/routes/' . $file . '.php';
}

try {
    apply_cors();
    if (Request::method() === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    start_session();
    verify_csrf();

    $path = Request::path();
    $method = Request::method();
    $pathMatched = false;
    foreach ($routes as [$routeMethod, $regex, $handler]) {
        if (preg_match($regex, $path, $m)) {
            $pathMatched = true;
            if ($routeMethod === $method) {
                $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);
                $handler($params);
            }
        }
    }
    throw new ApiException($pathMatched ? 405 : 404, $pathMatched ? 'Metod qo‘llab-quvvatlanmaydi.' : 'Manzil topilmadi.');
} catch (ApiException $e) {
    fail($e->status, $e->getMessage(), $e->errors);
} catch (Throwable $e) {
    error_log('[testflow] ' . $e::class . ': ' . $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine());
    $errors = is_production() ? [] : ['debug' => $e->getMessage()];
    fail(500, 'Serverda kutilmagan xatolik yuz berdi.', $errors);
}
