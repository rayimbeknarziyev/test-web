<?php
declare(strict_types=1);

route('GET', '/statistics', fn() => StatsController::overview());
route('GET', '/mistakes', fn() => StatsController::mistakes());
