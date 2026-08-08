<?php
declare(strict_types=1);

require_once __DIR__ . "/auth.php";
require_once __DIR__ . "/password_reset.php";

$pdo = db();
$token = (string) ($_GET["token"] ?? ($_POST["token"] ?? ""));
$error = "";

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $password = (string) ($_POST["password"] ?? "");
    $confirm = (string) ($_POST["confirm"] ?? "");
    if ($password === "" || $confirm === "") {
        $error = "Please enter your new password twice.";
    } elseif ($password !== $confirm) {
        $error = "Passwords do not match.";
    } elseif (($policyError = passwordPolicyError($password)) !== "") {
        $error = $policyError;
    } else {
        $reset = getPasswordReset($pdo, $token);
        if (!$reset) {
            $error = "This reset link is invalid or expired.";
        } else {
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
            $stmt->execute([$hash, (int) $reset["user_id"]]);
            markPasswordResetUsed($pdo, (int) $reset["id"]);
            $stmt = $pdo->prepare("SELECT id, email, role FROM users WHERE id = ? LIMIT 1");
            $stmt->execute([(int) $reset["user_id"]]);
            $user = $stmt->fetch();
            if ($user) {
                loginUser($user);
            }
            header("Location: " . APP_URL);
            exit;
        }
    }
}

$message = "Set your password to activate your account.";
$reset = getPasswordReset($pdo, $token);
if (!$reset) {
    $message = "This reset link is invalid or expired.";
}

echo "<!doctype html><html><head><meta charset=\"utf-8\" />"
    . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />"
    . "<title>Set Password</title>"
    . "<style>body{font-family:Arial,sans-serif;background:#f6f6fb;"
    . "display:grid;place-items:center;min-height:100vh;margin:0;}form{background:#fff;"
    . "padding:24px;border-radius:16px;box-shadow:0 12px 24px rgba(0,0,0,0.12);"
    . "display:grid;gap:12px;min-width:280px;}input{padding:10px;border-radius:8px;"
    . "border:1px solid #ddd;}button{padding:10px;border-radius:999px;border:none;"
    . "background:#4b1cff;color:#fff;font-weight:600;}p{margin:0;color:#555;font-size:13px;}"
    . ".error{color:#a01912;font-weight:600;}</style></head><body>"
    . "<form method=\"post\">"
    . "<strong>Set your password</strong>"
    . "<p>{$message}</p>"
    . ($error ? "<p class=\"error\">" . htmlspecialchars($error, ENT_QUOTES) . "</p>" : "")
    . "<input type=\"hidden\" name=\"token\" value=\"" . htmlspecialchars($token, ENT_QUOTES) . "\" />"
    . "<input name=\"password\" type=\"password\" placeholder=\"New password\" required />"
    . "<input name=\"confirm\" type=\"password\" placeholder=\"Confirm password\" required />"
    . "<button type=\"submit\">Save password</button>"
    . "</form></body></html>";
