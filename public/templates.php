<?php
declare(strict_types=1);

require_once "../admin/auth.php";
require_once "../admin/projects_helpers.php";

$user = requireLogin();
$pdo = db();

// Get all of the projects marked as templates.
$projects = $pdo->query("SELECT * FROM projects WHERE is_template = 1 ORDER BY published_at DESC")->fetchAll();

$rows = "";
foreach ($projects as $project) {
    $slug = htmlspecialchars($project["slug"] ?? "", ENT_QUOTES);
    $name = htmlspecialchars($project["name"] ?? "Untitled Project", ENT_QUOTES);
    $url = htmlspecialchars($project["url"] ?? "#", ENT_QUOTES);
    $description = htmlspecialchars($project["description"] ?? "", ENT_QUOTES);
    $author = htmlspecialchars($project["author"] ?? ($project["creator"] ?? ""), ENT_QUOTES);
    $publishedAt = $project["published_at"] ? date("M j, Y", (int) $project["published_at"]) : "";
    $meta = trim(($author ? "By {$author}" : "") . ($publishedAt ? " · {$publishedAt}" : ""), " ·");
    $adminUrl = htmlspecialchars(PROJECT_URL_BASE . $slug . "/admin.php", ENT_QUOTES);
    $rows .= "<div class=\"card\">"
        . "<div class=\"card-head\">"
        . "<strong><a href=\"{$url}\" target=\"_blank\" rel=\"noopener\">{$name}</a></strong>"
        . "<span>{$slug}</span>"
        . "</div>"
        . "<div class=\"meta\">{$meta}</div>"
        . ($description ? "<p>{$description}</p>" : "")
        . "<div class=\"actions\">"
        . ($user["role"] === "manager" ? "<a class=\" btn outline\" href=\"{$adminUrl}\">Admin</a>" : "") 
        . "<a class=\"btn outline\" href=\"{$url}\" target=\"_blank\" rel=\"noopener\">Open</a>"
        . "</div>"
        . "</div>";
}
if ($rows === "") {
    $rows = "<p class=\"empty\">No template projects yet.</p>";
}

// TODO: unlinline all the CSS. Not sure why it was done this way.

echo "<!doctype html><html><head><meta charset=\"utf-8\" />"
    . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />"
    . "<title>Template Projects</title>"
    . "<style>"
    . "body{margin:0;font-family:Arial,sans-serif;background:#f6f6fb;color:#1b1736;}"
    . ".wrap{max-width:960px;margin:0 auto;padding:32px 20px;}"
    . "h1{margin:0 0 20px;font-size:28px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;}"
    . ".toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;}"
    . ".toolbar a{text-decoration:none;background:#3b2d72;color:#fff;padding:6px 10px;border-radius:999px;font-size:12px;}"
    . ".toolbar a.outline{background:#fff;color:#3b2d72;border:1px solid #3b2d72;}"
    . ".grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));}"
    . ".card{background:#fff;border-radius:16px;padding:16px;box-shadow:0 12px 24px rgba(0,0,0,0.08);display:grid;gap:10px;}"
    . ".card-head{display:flex;flex-direction:column;gap:4px;}"
    . ".card a{text-decoration:none;color:#4b1cff;}"
    . ".meta{font-size:12px;color:#5b5875;}"
    . ".actions{display:flex;gap:8px;flex-wrap:wrap;}"
    . ".btn{font-size:12px;text-decoration:none;color:#fff;background:#3b2d72;"
    . "padding:6px 10px;border-radius:999px;}"
    . ".btn.outline{background:#fff;color:#3b2d72;border:1px solid #3b2d72;}"
    . ".empty{color:#5b5875;}"
    . ".sort-row{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px;}"
    . ".sort-row a{text-decoration:none;background:#fff;color:#3b2d72;border:1px solid #3b2d72;"
    . "padding:6px 10px;border-radius:999px;font-size:12px;}"
    . ".sort-row a.is-active{background:#3b2d72;color:#fff;}"
    . "</style></head><body><div class=\"wrap\">"
    . "<div class=\"toolbar\">"
    . "<a href=\"" . APP_URL . "\">Glitchlet</a>"
    . "<a class=\"outline\" href=\"/publish/projects.php\">My Published Projects</a>"
    . ($user["role"] === "manager" ? "<a class=\"outline\" href=\"/admin/manager.php\">Manager</a>" : "")
    . "</div>"
    . "<h1>Template Projects</h1>"
    . "<div class=\"grid\">{$rows}</div>"
    . "</div></body></html>";
