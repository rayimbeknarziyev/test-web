<?php
declare(strict_types=1);

route('GET', '/attempts/{id}/report', fn($p) => AttemptController::report($p));
