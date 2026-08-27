<?php
declare(strict_types=1);

require_once __DIR__ . "/db.php";

function requestIsHttps(): bool {
    if (!empty($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] !== "off") {
        return true;
    }
    // Behind a reverse proxy or load balancer, HTTPS terminates upstream and
    // only X-Forwarded-Proto reveals the original scheme.
    return strtolower((string) ($_SERVER["HTTP_X_FORWARDED_PROTO"] ?? "")) === "https";
}

function startSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name(SESSION_COOKIE_NAME);
    session_set_cookie_params([
        "lifetime" => 0,
        "path" => "/",
        "secure" => requestIsHttps(),
        "httponly" => true,
        "samesite" => "Lax",
    ]);
    session_start();
}

function currentUser(): ?array {
    startSession();
    $user = $_SESSION["user"] ?? null;
    return is_array($user) ? $user : null;
}

function loginUser(array $user): void {
    startSession();
    session_regenerate_id(true);
    $_SESSION["user"] = [
        "id" => (int) $user["id"],
        "email" => (string) $user["email"],
        "role" => (string) $user["role"],
    ];
}

function logoutUser(): void {
    startSession();
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), "", time() - 42000, $params["path"], $params["domain"], $params["secure"], $params["httponly"]);
    }
    session_destroy();
}

const MIN_PASSWORD_LENGTH = 8;

function passwordPolicyError(string $password): string {
    if (strlen($password) < MIN_PASSWORD_LENGTH) {
        return "Password must be at least " . MIN_PASSWORD_LENGTH . " characters.";
    }
    return "";
}

function csrfToken(): string {
    startSession();
    if (empty($_SESSION["csrf_token"])) {
        $_SESSION["csrf_token"] = bin2hex(random_bytes(32));
    }
    return (string) $_SESSION["csrf_token"];
}

function csrfIsValid(): bool {
    startSession();
    $expected = (string) ($_SESSION["csrf_token"] ?? "");
    if ($expected === "") {
        return false;
    }
    $provided = (string) ($_POST["csrf_token"] ?? ($_SERVER["HTTP_X_CSRF_TOKEN"] ?? ""));
    return $provided !== "" && hash_equals($expected, $provided);
}

function safeRedirectPath(string $redirect, string $fallback = "/"): string {
    // Only allow same-origin absolute paths ("/foo"), not protocol-relative
    // ("//evil.example") or absolute URLs.
    if ($redirect === "" || $redirect[0] !== "/" || (isset($redirect[1]) && $redirect[1] === "/")) {
        return $fallback;
    }
    return $redirect;
}

function requireLogin(): array {
    $user = currentUser();
    if ($user) {
        return $user;
    }
    echo renderLoginPage("Sign in to continue.", $_SERVER["REQUEST_URI"] ?? "/");
    exit;
}

function requireRole(array $roles): array {
    $user = requireLogin();
    if (!in_array($user["role"], $roles, true)) {
        http_response_code(403);
        echo "Forbidden.";
        exit;
    }
    return $user;
}

function generatePassword(int $length = 12): string {
    $alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    $chars = [];
    $maxIndex = strlen($alphabet) - 1;
    for ($i = 0; $i < $length; $i++) {
        $chars[] = $alphabet[random_int(0, $maxIndex)];
    }
    return implode("", $chars);
}

function renderLoginPage(string $message = "", string $redirect = ""): string {
    $safeMessage = htmlspecialchars($message ?: "Sign in to continue.", ENT_QUOTES);
    $safeRedirect = htmlspecialchars($redirect ?: "/", ENT_QUOTES);
    $safeCsrf = htmlspecialchars(csrfToken(), ENT_QUOTES);
    return "<!doctype html><html><head><meta charset=\"utf-8\" />"
        . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />"
        . "<title>Glitchlet Login</title>"
        . "<style>body{font-family:Arial,sans-serif;background:#f6f6fb;"
        . "display:grid;place-items:center;min-height:100vh;margin:0;}form{background:#fff;"
        . "padding:24px;border-radius:16px;box-shadow:0 12px 24px rgba(0,0,0,0.12);"
        . "display:grid;gap:12px;min-width:280px;}input{padding:10px;border-radius:8px;"
        . "border:1px solid #ddd;}button{padding:10px;border-radius:999px;border:none;"
        . "background:#4b1cff;color:#fff;font-weight:600;}p{margin:0;color:#555;font-size:13px;}</style>"
        . "</head><body><form method=\"post\" action=\"/admin/login.php\">"
        . "<strong>Glitchlet Login</strong>"
        . "<p>{$safeMessage}</p>"
        . "<input type=\"hidden\" name=\"redirect\" value=\"{$safeRedirect}\" />"
        . "<input type=\"hidden\" name=\"csrf_token\" value=\"{$safeCsrf}\" />"
        . "<input name=\"email\" type=\"email\" placeholder=\"Email\" required />"
        . "<input name=\"password\" type=\"password\" placeholder=\"Password\" required />"
        . "<button type=\"submit\">Sign in</button><a href=\"/\">Back to editor</a></form></body></html>";
}
