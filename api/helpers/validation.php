<?php
declare(strict_types=1);

function clean_text(mixed $value, int $maxLen, bool $multiline = true): string
{
    if (!is_string($value)) {
        return '';
    }
    if (!mb_check_encoding($value, 'UTF-8')) {
        return '';
    }
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    if (!$multiline) {
        $value = preg_replace('/\s+/u', ' ', $value) ?? '';
    }
    $value = trim($value);
    return mb_strlen($value) > $maxLen ? '' : $value;
}

function validate_email_value(mixed $email): ?string
{
    if (!is_string($email)) {
        return null;
    }
    $email = mb_strtolower(trim($email));
    if ($email === '' || strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return null;
    }
    return $email;
}

function password_problem(mixed $password): ?string
{
    if (!is_string($password) || $password === '') {
        return 'Parol kiritilmagan.';
    }
    if (strlen($password) < 8) {
        return 'Parol kamida 8 ta belgidan iborat bo‘lishi kerak.';
    }
    if (strlen($password) > 72) {
        return 'Parol 72 baytdan oshmasligi kerak.';
    }
    if (!preg_match('/\p{L}/u', $password) || !preg_match('/\d/', $password)) {
        return 'Parolda kamida bitta harf va bitta raqam bo‘lishi kerak.';
    }
    return null;
}

function throw_validation(array $errors, string $message = 'Ma’lumotlar noto‘g‘ri.'): never
{
    throw new ApiException(422, $message, $errors);
}
