<?php
declare(strict_types=1);

final class HealthController
{
    public static function check(): never
    {
        $dbOk = false;
        try {
            $dbOk = db_value('SELECT 1') === 1;
        } catch (Throwable $e) {
            $dbOk = false;
        }
        $status = $dbOk ? 200 : 503;
        respond($status, ['success' => $dbOk, 'data' => ['php' => PHP_VERSION, 'database' => $dbOk ? 'up' : 'down'], 'message' => $dbOk ? 'OK' : 'Ma’lumotlar bazasiga ulanib bo‘lmadi.']);
    }
}
