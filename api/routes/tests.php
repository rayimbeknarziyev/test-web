<?php
declare(strict_types=1);

route('GET', '/tests', fn() => TestController::index());
route('POST', '/tests', fn() => TestController::store());
route('GET', '/tests/{id}', fn($p) => TestController::show($p));
route('PATCH', '/tests/{id}', fn($p) => TestController::update($p));
route('DELETE', '/tests/{id}', fn($p) => TestController::destroy($p));
route('GET', '/tests/{id}/preview', fn($p) => TestController::preview($p));
route('POST', '/tests/{id}/versions', fn($p) => TestController::newVersion($p));
route('POST', '/tests/{id}/attempts', fn($p) => AttemptController::create($p));
