<?php
declare(strict_types=1);

require_once __DIR__ . "/auth.php";
require_once __DIR__ . "/rate_limit.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["ok" => false, "error" => "Method not allowed."]);
    exit;
}

$raw = file_get_contents("php://input");
$payload = $raw ? json_decode($raw, true) : null;
$email = trim((string) (($payload["email"] ?? null) ?? ($_POST["email"] ?? "")));
$password = (string) (($payload["password"] ?? null) ?? ($_POST["password"] ?? ""));
$redirect = safeRedirectPath((string) ($_POST["redirect"] ?? ""), "/publish/projects.php");
$isForm = !empty($_POST);

if (!csrfIsValid()) {
    if ($isForm) {
        http_response_code(403);
        echo renderLoginPage("Your session expired. Please try again.", $redirect);
        exit;
    }
    http_response_code(403);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["ok" => false, "error" => "Invalid request token. Reload and try again."]);
    exit;
}

if ($email === "" || $password === "") {
    if ($isForm) {
        http_response_code(400);
        echo renderLoginPage("Email and password required.", $redirect);
        exit;
    }
    http_response_code(400);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["ok" => false, "error" => "Email and password required."]);
    exit;
}

$pdo = db();
$ip = (string) ($_SERVER["REMOTE_ADDR"] ?? "");
ensureLoginAttemptsTable($pdo);
if (loginIsRateLimited($pdo, $email, $ip)) {
    if ($isForm) {
        http_response_code(429);
        echo renderLoginPage("Too many login attempts. Try again in a few minutes.", $redirect);
        exit;
    }
    http_response_code(429);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["ok" => false, "error" => "Too many login attempts. Try again in a few minutes."]);
    exit;
}

$stmt = $pdo->prepare("SELECT id, email, role, password_hash FROM users WHERE email = ? LIMIT 1");
$stmt->execute([$email]);
$user = $stmt->fetch();
if (!$user || !password_verify($password, (string) ($user["password_hash"] ?? ""))) {
    recordFailedLogin($pdo, $email, $ip);
    if ($isForm) {
        http_response_code(403);
        echo renderLoginPage("Login failed.", $redirect);
        exit;
    }
    http_response_code(403);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(["ok" => false, "error" => "Login failed."]);
    exit;
}

clearFailedLogins($pdo, $email);
$pdo->prepare("UPDATE users SET last_login_at = NOW() WHERE id = ?")->execute([$user["id"]]);
loginUser($user);

if ($isForm) {
    header("Location: " . $redirect);
    exit;
}

header("Content-Type: application/json; charset=utf-8");
echo json_encode([
    "ok" => true,
    "user" => [
        "id" => (int) $user["id"],
        "email" => (string) $user["email"],
        "role" => (string) $user["role"],
    ],
    "csrf" => csrfToken(),
], JSON_UNESCAPED_SLASHES);
