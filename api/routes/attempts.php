<?php
declare(strict_types=1);

route('GET', '/attempts', fn() => AttemptController::index());
route('GET', '/attempts/{id}', fn($p) => AttemptController::show($p));
route('POST', '/attempts/{id}/answers', fn($p) => AttemptController::answer($p));
route('PATCH', '/attempts/{id}/progress', fn($p) => AttemptController::progress($p));
route('POST', '/attempts/{id}/finish', fn($p) => AttemptController::finish($p));
route('POST', '/attempts/{id}/resume', fn($p) => AttemptController::resume($p));
route('GET', '/attempts/{id}/review', fn($p) => AttemptController::review($p));
