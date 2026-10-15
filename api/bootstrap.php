<?php
declare(strict_types=1);

require_once __DIR__ . '/config/app.php';
date_default_timezone_set((string) cfg('APP_TIMEZONE', 'Asia/Tashkent'));
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/helpers/validation.php';
require_once __DIR__ . '/middleware/auth.php';
require_once __DIR__ . '/middleware/csrf.php';
foreach (['RateLimiter', 'TestService', 'StatsService', 'AttemptService'] as $name) {
    require_once __DIR__ . '/services/' . $name . '.php';
}
foreach (['AuthController', 'TestController', 'AttemptController', 'StatsController', 'BookmarkController', 'HealthController'] as $name) {
    require_once __DIR__ . '/controllers/' . $name . '.php';
}

ini_set('display_errors', '0');
error_reporting(E_ALL);
