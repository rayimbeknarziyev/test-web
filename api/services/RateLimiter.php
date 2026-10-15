<?php
declare(strict_types=1);

final class RateLimiter
{
    public static function hit(string $action, string $subject, int $max, int $windowSeconds): void
    {
        $key = sha1($action . '|' . $subject);
        db_exec(
            'INSERT INTO rate_limits (key_hash, hits, window_start) VALUES (?, 1, NOW())
             ON DUPLICATE KEY UPDATE
               hits = IF(window_start < NOW() - INTERVAL ? SECOND, 1, hits + 1),
               window_start = IF(window_start < NOW() - INTERVAL ? SECOND, NOW(), window_start)',
            [$key, $windowSeconds, $windowSeconds]
        );
        $hits = (int) db_value('SELECT hits FROM rate_limits WHERE key_hash = ?', [$key]);
        if ($hits > $max) {
            throw new ApiException(429, 'Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.');
        }
    }

    public static function reset(string $action, string $subject): void
    {
        db_exec('DELETE FROM rate_limits WHERE key_hash = ?', [sha1($action . '|' . $subject)]);
    }
}
