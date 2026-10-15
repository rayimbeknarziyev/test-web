<?php
declare(strict_types=1);

function load_env(): array
{
    $candidates = [
        (string) getenv('TESTFLOW_ENV'),
        dirname(__DIR__, 3) . '/testflow.env',
        dirname(__DIR__, 2) . '/.env',
    ];
    foreach ($candidates as $file) {
        if ($file !== '' && is_file($file) && is_readable($file)) {
            $env = [];
            foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
                    continue;
                }
                [$k, $v] = explode('=', $line, 2);
                $env[trim($k)] = trim(trim($v), "\"'");
            }
            return $env;
        }
    }
    return [];
}

function cfg(string $key, mixed $default = null): mixed
{
    static $env = null;
    $env ??= load_env();
    $value = $env[$key] ?? getenv($key);
    if ($value === false || $value === null || $value === '') {
        return $default;
    }
    return $value;
}

function is_production(): bool
{
    return cfg('APP_ENV', 'local') === 'production';
}
