<?php
declare(strict_types=1);

require_once __DIR__ . "/auth.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["ok" => false, "error" => "Method not allowed."]);
    exit;
}

if (!csrfIsValid()) {
    http_response_code(403);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["ok" => false, "error" => "Invalid request token."]);
    exit;
}

logoutUser();
$redirect = (string) ($_POST["redirect"] ?? "");
if ($redirect !== "") {
    header("Location: " . safeRedirectPath($redirect));
    exit;
}

header("Content-Type: application/json; charset=utf-8");
echo json_encode(["ok" => true]);
