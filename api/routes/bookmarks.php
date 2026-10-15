<?php
declare(strict_types=1);

route('GET', '/bookmarks', fn() => BookmarkController::index());
route('POST', '/bookmarks', fn() => BookmarkController::store());
route('DELETE', '/bookmarks/{id}', fn($p) => BookmarkController::destroy($p));
