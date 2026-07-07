<?php
declare(strict_types=1);

$lockPath = __DIR__ . "/install.lock";
$configPath = __DIR__ . "/publish/config.php";
$schemaPath = __DIR__ . "/db/schema.sql";
$projectsRoot = __DIR__ . "/projects";

function baseUrl(): string {
    $scheme = (!empty($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] !== "off") ? "https" : "http";
    $host = $_SERVER["HTTP_HOST"] ?? "localhost";
    $scriptDir = rtrim(str_replace("\\", "/", dirname($_SERVER["SCRIPT_NAME"] ?? "/")), "/");
    $base = $scriptDir === "" ? "" : $scriptDir;
    return $scheme . "://" . $host . $base . "/";
}

function sanitizeUrl(string $value): string {
    $trimmed = trim($value);
    if ($trimmed === "") {
        return "";
    }
    if (substr($trimmed, -1) !== "/") {
        $trimmed .= "/";
    }
    return $trimmed;
}

function splitSqlStatements(string $sql): array {
    $statements = [];
    $buffer = "";
    $inString = false;
    $stringChar = "";
    $len = strlen($sql);
    for ($i = 0; $i < $len; $i++) {
        $char = $sql[$i];
        if ($inString) {
            $buffer .= $char;
            if ($char === $stringChar) {
                $prev = $i > 0 ? $sql[$i - 1] : "";
                if ($prev !== "\\") {
                    $inString = false;
                    $stringChar = "";
                }
            }
            continue;
        }
        if ($char === "'" || $char === "\"") {
            $inString = true;
            $stringChar = $char;
            $buffer .= $char;
            continue;
        }
        if ($char === ";") {
            $statement = trim($buffer);
            if ($statement !== "") {
                $statements[] = $statement;
            }
            $buffer = "";
            continue;
        }
        $buffer .= $char;
    }
    $tail = trim($buffer);
    if ($tail !== "") {
        $statements[] = $tail;
    }
    return $statements;
}

function writeConfig(string $path, array $values): bool {
    $lines = [];
    $lines[] = "<?php";
    $lines[] = "declare(strict_types=1);";
    $lines[] = "";
    $lines[] = "function envValue(string \$key, string \$default): string {";
    $lines[] = "    \$value = getenv(\$key);";
    $lines[] = "    if (\$value === false || \$value === \"\") {";
    $lines[] = "        return \$default;";
    $lines[] = "    }";
    $lines[] = "    return \$value;";
    $lines[] = "}";
    $lines[] = "";
    $lines[] = "define(\"APP_URL\", envValue(\"GLITCHLET_APP_URL\", " . var_export($values["app_url"], true) . "));";
    $lines[] = "define(\"APP_ORIGIN\", envValue(\"GLITCHLET_APP_ORIGIN\", " . var_export($values["app_origin"], true) . "));";
    $lines[] = "define(\"PROJECT_URL_BASE\", APP_URL . \"projects/\");";
    $lines[] = "define(\"PROJECTS_ROOT\", envValue(\"GLITCHLET_PROJECTS_ROOT\", __DIR__ . \"/../projects\"));";
    $lines[] = "define(\"SESSION_COOKIE_NAME\", envValue(\"GLITCHLET_SESSION_COOKIE\", \"glitchlet_session\"));";
    $lines[] = "define(\"BOOTSTRAP_TOKEN\", envValue(\"GLITCHLET_BOOTSTRAP_TOKEN\", " . var_export($values["bootstrap_token"], true) . "));";
    $lines[] = "";
    $lines[] = "define(\"DB_HOST\", envValue(\"GLITCHLET_DB_HOST\", " . var_export($values["db_host"], true) . "));";
    $lines[] = "define(\"DB_PORT\", envValue(\"GLITCHLET_DB_PORT\", " . var_export($values["db_port"], true) . "));";
    $lines[] = "define(\"DB_NAME\", envValue(\"GLITCHLET_DB_NAME\", " . var_export($values["db_name"], true) . "));";
    $lines[] = "define(\"DB_USER\", envValue(\"GLITCHLET_DB_USER\", " . var_export($values["db_user"], true) . "));";
    $lines[] = "define(\"DB_PASS\", envValue(\"GLITCHLET_DB_PASS\", " . var_export($values["db_pass"], true) . "));";
    $lines[] = "";
    $lines[] = "define(\"SMTP_ENABLED\", envValue(\"GLITCHLET_SMTP_ENABLED\", " . var_export($values["smtp_enabled"], true) . "));";
    $lines[] = "define(\"SMTP_HOST\", envValue(\"GLITCHLET_SMTP_HOST\", " . var_export($values["smtp_host"], true) . "));";
    $lines[] = "define(\"SMTP_PORT\", envValue(\"GLITCHLET_SMTP_PORT\", " . var_export($values["smtp_port"], true) . "));";
    $lines[] = "define(\"SMTP_USER\", envValue(\"GLITCHLET_SMTP_USER\", " . var_export($values["smtp_user"], true) . "));";
    $lines[] = "define(\"SMTP_PASS\", envValue(\"GLITCHLET_SMTP_PASS\", " . var_export($values["smtp_pass"], true) . "));";
    $lines[] = "define(\"SMTP_FROM\", envValue(\"GLITCHLET_SMTP_FROM\", " . var_export($values["smtp_from"], true) . "));";
    $lines[] = "define(\"SMTP_FROM_NAME\", envValue(\"GLITCHLET_SMTP_FROM_NAME\", " . var_export($values["smtp_from_name"], true) . "));";
    $lines[] = "define(\"SMTP_SECURE\", envValue(\"GLITCHLET_SMTP_SECURE\", " . var_export($values["smtp_secure"], true) . "));";
    $lines[] = "";
    return file_put_contents($path, implode("\n", $lines)) !== false;
}

$errors = [];
$success = "";
$values = [
    "app_url" => sanitizeUrl($_POST["app_url"] ?? baseUrl()),
    "app_origin" => rtrim($_POST["app_origin"] ?? rtrim(baseUrl(), "/"), "/"),
    "db_host" => $_POST["db_host"] ?? "localhost",
    "db_port" => $_POST["db_port"] ?? "3306",
    "db_name" => $_POST["db_name"] ?? "",
    "db_user" => $_POST["db_user"] ?? "",
    "db_pass" => $_POST["db_pass"] ?? "",
    "smtp_enabled" => !empty($_POST["smtp_enabled"]) ? "1" : "0",
    "smtp_host" => $_POST["smtp_host"] ?? "smtp.gmail.com",
    "smtp_port" => $_POST["smtp_port"] ?? "587",
    "smtp_user" => $_POST["smtp_user"] ?? "",
    "smtp_pass" => $_POST["smtp_pass"] ?? "",
    "smtp_from" => $_POST["smtp_from"] ?? "",
    "smtp_from_name" => $_POST["smtp_from_name"] ?? "Glitchlet",
    "smtp_secure" => $_POST["smtp_secure"] ?? "tls",
    "bootstrap_token" => $_POST["bootstrap_token"] ?? bin2hex(random_bytes(16)),
    "manager_email" => $_POST["manager_email"] ?? "",
    "manager_password" => $_POST["manager_password"] ?? "",
];

if (file_exists($lockPath)) {
    http_response_code(403);
    echo "<!doctype html><html><head><meta charset=\"utf-8\" />"
        . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />"
        . "<title>Installer Locked</title>"
        . "<style>"
        . "body{margin:0;font-family:Arial,sans-serif;background:#f6f6fb;color:#1b1736;"
        . "display:grid;place-items:center;min-height:100vh;}"
        . ".panel{background:#fff;border-radius:18px;padding:20px 22px;box-shadow:0 14px 28px rgba(0,0,0,0.08);"
        . "max-width:520px;text-align:center;}"
        . "h1{margin:0 0 10px;font-size:24px;}"
        . "p{margin:0;color:#5b5875;}"
        . "</style></head><body><div class=\"panel\">"
        . "<h1>Installer locked</h1>"
        . "<p>Delete install.lock to re-run the installer.</p>"
        . "<p><a href=\"/\">Back to Glitchlet</a></p>"
        . "</div></body></html>";
    exit;
}

if ($_SERVER["REQUEST_METHOD"] === "POST" && !$errors) {
    if ($values["app_url"] === "" || $values["app_origin"] === "") {
        $errors[] = "App URL and origin are required.";
    }
    if ($values["db_name"] === "" || $values["db_user"] === "") {
        $errors[] = "Database name and user are required.";
    }
    if ($values["manager_email"] === "" || $values["manager_password"] === "") {
        $errors[] = "Manager email and password are required.";
    } elseif (strlen((string) $values["manager_password"]) < 8) {
        $errors[] = "Manager password must be at least 8 characters.";
    }
    if (!filter_var($values["manager_email"], FILTER_VALIDATE_EMAIL)) {
        $errors[] = "Manager email is not valid.";
    }
    if ($values["smtp_enabled"] === "1" && ($values["smtp_user"] === "" || $values["smtp_pass"] === "")) {
        $errors[] = "SMTP user and password are required when SMTP is enabled.";
    }
    if (!$errors) {
        if (!is_dir($projectsRoot) && !mkdir($projectsRoot, 0755, true)) {
            $errors[] = "Failed to create /projects directory.";
        } else {
            @chmod($projectsRoot, 0755);
        }
    }
    if (!$errors) {
        if (file_exists($configPath)) {
            $errors[] = "publish/config.php already exists. Remove it before running the installer.";
        } else {
            if (!writeConfig($configPath, $values)) {
                $errors[] = "Failed to write publish/config.php.";
            }
        }
    }
    if (!$errors) {
        try {
            $dsn = "mysql:host=" . $values["db_host"] . ";port=" . $values["db_port"] . ";dbname=" . $values["db_name"] . ";charset=utf8mb4";
            $pdo = new PDO($dsn, $values["db_user"], $values["db_pass"], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
            $schema = file_get_contents($schemaPath);
            if ($schema === false) {
                $errors[] = "Failed to read schema.sql.";
            } else {
                $statements = splitSqlStatements($schema);
                foreach ($statements as $statement) {
                    try {
                        $pdo->exec($statement);
                    } catch (PDOException $e) {
                        if ($e->getCode() !== "42S01") {
                            $errors[] = "Schema error: " . $e->getMessage();
                            break;
                        }
                    }
                }
            }
            if (!$errors) {
                $stmt = $pdo->query("SELECT COUNT(*) AS count FROM users WHERE role = 'manager'");
                $count = (int) (($stmt->fetch()["count"] ?? 0));
                if ($count === 0) {
                    $hash = password_hash($values["manager_password"], PASSWORD_DEFAULT);
                    $stmt = $pdo->prepare("INSERT INTO users (email, role, password_hash) VALUES (?, 'manager', ?)");
                    $stmt->execute([$values["manager_email"], $hash]);
                }
            }
        } catch (PDOException $e) {
            $errors[] = "Database connection failed: " . $e->getMessage();
        }
    }
    if (!$errors) {
        file_put_contents($lockPath, "Installed: " . date("c") . "\n");
        $success = "Install complete. You can now log in as manager. "
            . "For extra safety, delete install.php from the server.";
    }
}

function esc(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES);
}

echo "<!doctype html><html><head><meta charset=\"utf-8\" />"
    . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />"
    . "<title>Glitchlet Installer</title>"
    . "<style>"
    . "*{box-sizing:border-box;}"
    . "body{margin:0;font-family:Arial,sans-serif;background:#f6f6fb;color:#1b1736;}"
    . ".wrap{max-width:720px;margin:0 auto;padding:32px 20px;}"
    . "h1{margin:0 0 16px;font-size:28px;}"
    . ".panel{background:#fff;border-radius:18px;padding:20px;box-shadow:0 14px 28px rgba(0,0,0,0.08);"
    . "display:grid;gap:12px;margin-bottom:18px;}"
    . "label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5b5875;}"
    . "input{padding:10px;border-radius:10px;border:1px solid #ddd;font-size:14px;width:100%;}"
    . ".row{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));}"
    . ".row>div{display:flex;flex-direction:column;gap:6px;}"
    . "button{padding:10px 18px;border-radius:999px;border:none;font-weight:600;cursor:pointer;"
    . "background:#3b2d72;color:#fff;}"
    . ".note{font-size:13px;color:#555;}"
    . ".error{background:#ffe9e6;color:#a01912;padding:12px;border-radius:12px;}"
    . ".success{background:#e9f6ef;color:#0b5b2a;padding:12px;border-radius:12px;}"
    . ".checkbox{display:flex;align-items:center;gap:8px;font-size:13px;color:#444;}"
    . "</style></head><body><div class=\"wrap\">"
    . "<h1>Glitchlet Setup</h1>";

if ($errors) {
    echo "<div class=\"error\">" . esc(implode(" ", $errors)) . "</div>";
}
if ($success) {
    echo "<div class=\"success\">" . esc($success) . " <a href=\"" . esc($values["app_url"]) . "\">Open app</a>.</div>";
}

echo "<form method=\"post\">"
    . "<div class=\"panel\">"
    . "<h2>App</h2>"
    . "<label>App URL</label>"
    . "<input name=\"app_url\" value=\"" . esc($values["app_url"]) . "\" required />"
    . "<label>App Origin</label>"
    . "<input name=\"app_origin\" value=\"" . esc($values["app_origin"]) . "\" required />"
    . "<div class=\"note\">Example: https://glitchlet.yoursite.net/</div>"
    . "</div>"
    . "<div class=\"panel\">"
    . "<h2>Database</h2>"
    . "<div class=\"row\">"
    . "<div><label>Host</label><input name=\"db_host\" value=\"" . esc($values["db_host"]) . "\" required /></div>"
    . "<div><label>Port</label><input name=\"db_port\" value=\"" . esc($values["db_port"]) . "\" required /></div>"
    . "</div>"
    . "<label>Database name</label>"
    . "<input name=\"db_name\" value=\"" . esc($values["db_name"]) . "\" required />"
    . "<div class=\"row\">"
    . "<div><label>Database user</label><input name=\"db_user\" value=\"" . esc($values["db_user"]) . "\" required /></div>"
    . "<div><label>Database password</label><input name=\"db_pass\" type=\"password\" autocomplete=\"new-password\" /></div>"
    . "</div>"
    . "</div>"
    . "<div class=\"panel\">"
    . "<h2>SMTP (Gmail)</h2>"
    . "<label class=\"checkbox\"><input type=\"checkbox\" name=\"smtp_enabled\" value=\"1\""
    . ($values["smtp_enabled"] === "1" ? " checked" : "") . " />Enable SMTP</label>"
    . "<div class=\"row\">"
    . "<div><label>Host</label><input name=\"smtp_host\" value=\"" . esc($values["smtp_host"]) . "\" /></div>"
    . "<div><label>Port</label><input name=\"smtp_port\" value=\"" . esc($values["smtp_port"]) . "\" /></div>"
    . "</div>"
    . "<div class=\"row\">"
    . "<div><label>SMTP user (full Gmail)</label><input name=\"smtp_user\" value=\"" . esc($values["smtp_user"]) . "\" /></div>"
    . "<div><label>SMTP pass (app password)</label><input name=\"smtp_pass\" type=\"password\" autocomplete=\"new-password\" /></div>"
    . "</div>"
    . "<div class=\"row\">"
    . "<div><label>From email</label><input name=\"smtp_from\" value=\"" . esc($values["smtp_from"]) . "\" /></div>"
    . "<div><label>From name</label><input name=\"smtp_from_name\" value=\"" . esc($values["smtp_from_name"]) . "\" /></div>"
    . "</div>"
    . "<label>Security (tls or ssl)</label>"
    . "<input name=\"smtp_secure\" value=\"" . esc($values["smtp_secure"]) . "\" />"
    . "<div class=\"note\">Gmail app passwords: Google Account → Security → App passwords.</div>"
    . "</div>"
    . "<div class=\"panel\">"
    . "<h2>Manager Account</h2>"
    . "<label>Email</label>"
    . "<input name=\"manager_email\" type=\"email\" value=\"" . esc($values["manager_email"]) . "\" required />"
    . "<label>Password (at least 8 characters)</label>"
    . "<input name=\"manager_password\" type=\"password\" autocomplete=\"new-password\" required />"
    . "<label>Bootstrap token</label>"
    . "<input name=\"bootstrap_token\" value=\"" . esc($values["bootstrap_token"]) . "\" />"
    . "</div>"
    . "<button type=\"submit\">Install Glitchlet</button>"
    . "</form>"
    . "</div></body></html>";
