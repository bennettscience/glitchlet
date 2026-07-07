<?php
declare(strict_types=1);

require_once __DIR__ . "/auth.php";

$lockPath = dirname(__DIR__) . "/install.lock";
if (file_exists($lockPath)) {
    http_response_code(403);
    echo "Bootstrap disabled.";
    exit;
}

$pdo = db();
$error = "";

$managers = $pdo->query("SELECT COUNT(*) AS count FROM users WHERE role = 'manager'")->fetch();
$hasManager = (int) ($managers["count"] ?? 0) > 0;

$token = (string) ($_GET["token"] ?? "");
if ($hasManager || $token === "" || !hash_equals(BOOTSTRAP_TOKEN, $token)) {
    http_response_code(403);
    echo "Bootstrap disabled.";
    exit;
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $email = strtolower(trim((string) ($_POST["email"] ?? "")));
    $password = (string) ($_POST["password"] ?? "");
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === "") {
        $error = "Valid email and password required.";
    } elseif (($policyError = passwordPolicyError($password)) !== "") {
        $error = $policyError;
    } else {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (email, role, password_hash) VALUES (?, 'manager', ?)");
        $stmt->execute([$email, $hash]);
        loginUser(["id" => (int) $pdo->lastInsertId(), "email" => $email, "role" => "manager"]);
        header("Location: /publish/manager.php");
        exit;
    }
}

echo "<!doctype html><html><head><meta charset=\"utf-8\" />"
    . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />"
    . "<title>Bootstrap Manager</title>"
    . "<style>body{font-family:Arial,sans-serif;background:#f6f6fb;"
    . "display:grid;place-items:center;min-height:100vh;margin:0;}form{background:#fff;"
    . "padding:24px;border-radius:16px;box-shadow:0 12px 24px rgba(0,0,0,0.12);"
    . "display:grid;gap:12px;min-width:280px;}input{padding:10px;border-radius:8px;"
    . "border:1px solid #ddd;}button{padding:10px;border-radius:999px;border:none;"
    . "background:#4b1cff;color:#fff;font-weight:600;}p{margin:0;color:#a01912;font-size:12px;}</style>"
    . "</head><body><form method=\"post\">"
    . "<strong>Create manager account</strong>"
    . (!empty($error) ? "<p>{$error}</p>" : "")
    . "<input name=\"email\" type=\"email\" placeholder=\"Email\" required />"
    . "<input name=\"password\" type=\"password\" placeholder=\"Password\" required />"
    . "<button type=\"submit\">Create manager</button>"
    . "</form></body></html>";
