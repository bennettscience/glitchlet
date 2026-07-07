<?php
declare(strict_types=1);

require_once __DIR__ . "/auth.php";

header("Content-Type: application/json; charset=utf-8");

$user = currentUser();
echo json_encode([
    "ok" => true,
    "user" => $user ? [
        "id" => (int) $user["id"],
        "email" => (string) $user["email"],
        "role" => (string) $user["role"],
    ] : null,
    "csrf" => csrfToken(),
], JSON_UNESCAPED_SLASHES);
