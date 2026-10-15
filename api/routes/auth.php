<?php
declare(strict_types=1);

route('GET', '/auth/csrf', fn() => AuthController::csrf());
route('POST', '/auth/register', fn() => AuthController::register());
route('POST', '/auth/login', fn() => AuthController::login());
route('POST', '/auth/logout', fn() => AuthController::logout());
route('GET', '/auth/me', fn() => AuthController::me());
route('POST', '/auth/forgot-password', fn() => AuthController::forgot());
route('POST', '/auth/reset-password', fn() => AuthController::reset());
route('PATCH', '/auth/profile', fn() => AuthController::profile());
route('POST', '/auth/password', fn() => AuthController::password());
route('GET', '/health', fn() => HealthController::check());
