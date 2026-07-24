<?php
declare(strict_types=1);

// Shared handler for per-project admin pages. Each published project gets a
// tiny stub at projects/{slug}/admin.php (see admin_template.php) that
// requires this file, so template changes apply to every project without
// regenerating the stubs. The slug is derived from the stub's directory.

require_once __DIR__ . "/auth.php";
require_once __DIR__ . "/projects_helpers.php";

$user = requireLogin();

$scriptPath = (string) ($_SERVER["SCRIPT_FILENAME"] ?? "");
$projectDir = $scriptPath !== "" ? realpath(dirname($scriptPath)) : false;
$projectsRoot = realpath(PROJECTS_ROOT);
if ($projectDir === false || $projectsRoot === false
    || $projectDir === $projectsRoot
    || strpos($projectDir, $projectsRoot . DIRECTORY_SEPARATOR) !== 0) {
    // Direct access to this handler (or a stub outside the projects root)
    // has no project to manage.
    http_response_code(404);
    echo "Project not found.";
    exit;
}
$slug = basename($projectDir);

$pdo = db();

$stmt = $pdo->prepare("SELECT * FROM projects WHERE slug = ? LIMIT 1");
$stmt->execute([$slug]);
$project = $stmt->fetch();
if (!$project) {
    http_response_code(404);
    echo "Project not found.";
    exit;
}

if ($user["role"] !== "manager" && (int) $project["owner_user_id"] !== (int) $user["id"]) {
    http_response_code(403);
    echo "Forbidden.";
    exit;
}

csrfToken();

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    if (!csrfIsValid()) {
        http_response_code(403);
        echo "Invalid CSRF token.";
        exit;
    }
    $action = $_POST["action"] ?? "";
    if ($action === "delete") {
        $pdo->prepare("DELETE FROM projects WHERE slug = ?")->execute([$slug]);
        deleteDirectory($projectDir);
        writeProjectsIndex($pdo);
        header("Location: /projects/index.html");
        exit;
    }
    // TODO: Add param for updating a project as a template.
    if ($action === "update") {
        $name = trim((string) ($_POST["name"] ?? $project["name"]));
        $description = trim((string) ($_POST["description"] ?? ""));
        $author = trim((string) ($_POST["author"] ?? ""));
        $updatedAt = time();
        $stmt = $pdo->prepare(
            "UPDATE projects SET name = ?, description = ?, author = ?, creator = ?, updated_at = ? WHERE slug = ?"
        );
        $stmt->execute([$name, $description, $author, $author, $updatedAt, $slug]);
        $project["name"] = $name;
        $project["description"] = $description;
        $project["author"] = $author;
        $project["creator"] = $author;
        $project["updated_at"] = $updatedAt;
        writeProjectJson($projectDir, $project);
        writeProjectsIndex($pdo);
        header("Location: " . $_SERVER["REQUEST_URI"]);
        exit;
    }
}

$name = htmlspecialchars($project["name"] ?? "Untitled Project", ENT_QUOTES);
$description = htmlspecialchars($project["description"] ?? "", ENT_QUOTES);
$author = htmlspecialchars($project["author"] ?? "", ENT_QUOTES);
$csrf = htmlspecialchars(csrfToken(), ENT_QUOTES);
$projectUrl = htmlspecialchars(($project["url"] ?? ""), ENT_QUOTES);
$projectsUrl = "/projects/index.html";
$appUrl = APP_URL;

echo "<!doctype html><html><head><meta charset=\"utf-8\" />"
    . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />"
    . "<title>Project Admin</title>"
    . "<style>body{font-family:Arial,sans-serif;background:#f6f6fb;margin:0;padding:32px;}"
    . ".card{max-width:720px;margin:0 auto;background:#fff;padding:24px;border-radius:18px;"
    . "box-shadow:0 16px 32px rgba(0,0,0,0.12);}label{font-size:12px;color:#555;"
    . "text-transform:uppercase;letter-spacing:0.08em;font-weight:700;}"
    . "input,textarea{width:100%;padding:10px;border-radius:10px;border:1px solid #ddd;"
    . "font-size:14px;}textarea{min-height:120px;resize:vertical;}"
    . "button{padding:10px 18px;border-radius:999px;border:none;font-weight:600;}"
    . ".primary{background:#4b1cff;color:#fff;}"
    . ".danger{background:#ffe9e6;color:#a01912;}"
    . ".nav{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 16px;}"
    . ".nav a{font-size:12px;text-decoration:none;color:#fff;background:#3b2d72;"
    . "padding:6px 10px;border-radius:999px;transition:transform 0.2s ease,box-shadow 0.2s ease;}"
    . ".nav a.outline{background:#fff;color:#3b2d72;border:1px solid #3b2d72;}"
    . ".nav a:hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(31,29,26,0.12);}"
    . ".row{display:grid;gap:12px;margin-top:16px;}"
    . ".actions{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;}"
    . "</style></head><body><div class=\"card\">"
    . "<div class=\"nav\">"
    . ($projectUrl ? "<a href=\"{$projectUrl}\" target=\"_blank\" rel=\"noopener\">This Project</a>" : "")
    . "<a class=\"outline\" href=\"{$projectsUrl}\">All Published Projects</a>"
    . "<a class=\"outline\" href=\"{$appUrl}\">Glitchlet</a>"
    . "</div>"
    . "<h1>Project Admin</h1>"
    . "<form method=\"post\" class=\"row\">"
    . "<input type=\"hidden\" name=\"csrf_token\" value=\"{$csrf}\" />"
    . "<input type=\"hidden\" name=\"action\" value=\"update\" />"
    . "<label>Project name</label>"
    . "<input name=\"name\" value=\"{$name}\" />"
    . "<label>Author</label>"
    . "<input name=\"author\" value=\"{$author}\" />"
    . "<label>Description</label>"
    . "<textarea name=\"description\">{$description}</textarea>"
    . "<div class=\"actions\"><button type=\"submit\" class=\"primary\">Save</button></div>"
    . "</form>"
    . "<form method=\"post\" onsubmit=\"return confirm('Delete this project?');\">"
    . "<input type=\"hidden\" name=\"csrf_token\" value=\"{$csrf}\" />"
    . "<input type=\"hidden\" name=\"action\" value=\"delete\" />"
    . "<div class=\"actions\"><button type=\"submit\" class=\"danger\">Delete project</button></div>"
    . "</form></div></body></html>";
