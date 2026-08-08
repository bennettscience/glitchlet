<?php
declare(strict_types=1);

require_once __DIR__ . "/config.php";

function ensureProjectsRoot(): void {
    if (!is_dir(PROJECTS_ROOT) && !mkdir(PROJECTS_ROOT, 0755, true)) {
        throw new RuntimeException("Failed to create projects root.");
    }
}

// Guarded because admin.php files generated from the pre-stub template
// define their own copy; without the guard they would fatal on redeclare.
if (!function_exists("deleteDirectory")) {
    function deleteDirectory(string $dir): void {
        if (!is_dir($dir)) {
            return;
        }
        $items = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($items as $item) {
            if ($item->isDir()) {
                @rmdir($item->getPathname());
            } else {
                @unlink($item->getPathname());
            }
        }
        @rmdir($dir);
    }
}

function regenerateAdminPages(PDO $pdo): int {
    ensureProjectsRoot();
    $stub = file_get_contents(__DIR__ . "/admin_template.php");
    if ($stub === false) {
        throw new RuntimeException("Failed to read admin template.");
    }
    $count = 0;
    foreach (glob(PROJECTS_ROOT . "/*", GLOB_ONLYDIR) ?: [] as $dir) {
        if (file_put_contents($dir . "/admin.php", $stub) !== false) {
            $count++;
        }
    }
    $projectsAdmin = file_get_contents(__DIR__ . "/projects_admin_template.php");
    if ($projectsAdmin !== false) {
        file_put_contents(PROJECTS_ROOT . "/admin.php", $projectsAdmin);
    }
    writeProjectsIndex($pdo);
    return $count;
}

function fetchProjects(PDO $pdo, ?int $ownerId = null): array {
    if ($ownerId) {
        $stmt = $pdo->prepare("SELECT * FROM projects WHERE owner_user_id = ? ORDER BY published_at DESC");
        $stmt->execute([$ownerId]);
        return $stmt->fetchAll();
    }
    $stmt = $pdo->query("SELECT * FROM projects ORDER BY published_at DESC");
    return $stmt->fetchAll();
}

function fetchTemplateProjects(PDO $pdo): array {
    $stmt = $pdo->prepare("SELECT * FROM projects WHERE is_template = 1 ORDER BY published_at DESC");
    $stmt->execute();
    return $stmt->fetchAll();
}

function buildIndexHtml(array $projects): string {
    $cards = "";
    $adminButton = "<a class=\"admin-btn\" href=\"/projects/admin.php\">Admin</a>"
        . "<a class=\"admin-btn outline\" href=\"" . APP_URL . "\">Back to App</a>";
    foreach ($projects as $project) {
        if (!empty($project["archived"])) {
            continue;
        }
        $name = htmlspecialchars($project["name"] ?? "Untitled Project", ENT_QUOTES);
        $url = htmlspecialchars($project["url"] ?? "#", ENT_QUOTES);
        $slug = htmlspecialchars($project["slug"] ?? "", ENT_QUOTES);
        $description = htmlspecialchars($project["description"] ?? "", ENT_QUOTES);
        $is_template = $project["is_template"];
        $author = htmlspecialchars($project["author"] ?? ($project["creator"] ?? ""), ENT_QUOTES);
        $timestamp = isset($project["published_at"])
            ? date("M j, Y", (int) $project["published_at"])
            : "";
        $meta = trim(($author ? "By " . $author : "") . ($timestamp ? " · " . $timestamp : ""), " ·");
        $cards .= "<article class=\"card\">"
            . "<h2><a href=\"{$url}\">{$name}</a></h2>"
            . ($is_template ? "Template" : "Not Template" )
            . "<div class=\"meta\">{$meta}</div>"
            . ($description ? "<p>{$description}</p>" : "")
            . "<div class=\"slug\">{$slug}</div>"
            . "</article>";
    }
    if ($cards === "") {
        $cards = "<p class=\"empty\">No projects published yet.</p>";
    }
    return "<!doctype html>"
        . "<html lang=\"en\"><head><meta charset=\"utf-8\" />"
        . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />"
        . "<title>Published Projects</title>"
        . "<style>"
        . "body{margin:0;font-family:Arial,sans-serif;background:#f6f6fb;color:#1b1736;}"
        . ".wrap{max-width:960px;margin:0 auto;padding:32px 20px;}"
        . "h1{margin:0 0 20px;font-size:28px;display:flex;align-items:center;gap:12px;}"
        . ".admin-btn{font-size:12px;text-decoration:none;color:#fff;background:#3b2d72;"
        . "padding:6px 10px;border-radius:999px;transition:transform 0.2s ease,box-shadow 0.2s ease;}"
        . ".admin-btn.outline{background:#fff;color:#3b2d72;border:1px solid #3b2d72;}"
        . ".admin-btn:hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(31,29,26,0.12);}"
        . ".grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));}"
        . ".card{background:#fff;border-radius:16px;padding:16px;box-shadow:0 12px 24px rgba(0,0,0,0.08);}"
        . ".card h2{margin:0 0 6px;font-size:18px;}"
        . ".card a{text-decoration:none;color:#4b1cff;}"
        . ".meta{font-size:12px;color:#5b5875;margin-bottom:8px;}"
        . ".slug{font-size:11px;color:#8b87a7;}"
        . ".empty{color:#5b5875;}"
        . "</style></head><body><div class=\"wrap\">"
        . "<h1>Published Projects {$adminButton}</h1>"
        . "<div class=\"grid\">{$cards}</div>"
        . "</div></body></html>";
}

function writeProjectsIndex(PDO $pdo): void {
    // Get a project filter if one exists
    $filter = $_GET["filter"] ?? null;

    ensureProjectsRoot();
    $projects = ($filter == "templates") ? fetchTemplateProjects($pdo) :  fetchProjects($pdo);
    $html = buildIndexHtml($projects);
    file_put_contents(PROJECTS_ROOT . "/index.html", $html);
}

function writeProjectJson(string $projectDir, array $project): void {
    $payload = [
        "slug" => $project["slug"] ?? "",
        "name" => $project["name"] ?? "",
        "description" => $project["description"] ?? "",
        "author" => $project["author"] ?? "",
        "creator" => $project["creator"] ?? "",
        "archived" => (bool) ($project["archived"] ?? false),
        "publishedAt" => (int) ($project["published_at"] ?? 0),
        "updatedAt" => (int) ($project["updated_at"] ?? 0),
        "url" => $project["url"] ?? "",
        "isTemplate" => (bool) ($project["is_template"] ?? false),
    ];
    file_put_contents($projectDir . "/project.json", json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}
