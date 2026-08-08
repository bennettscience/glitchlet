<?php
declare(strict_types=1);

require_once __DIR__ . "/config.php";
require_once __DIR__ . "/db.php";
require_once __DIR__ . "/auth.php";
require_once __DIR__ . "/projects_helpers.php";

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: " . APP_ORIGIN);
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

const MAX_ZIP_BYTES = 25 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 150 * 1024 * 1024;
const MAX_FILE_COUNT = 1200;
const MAX_PATH_LENGTH = 200;
const REMIX_ZIP_NAME = "remix.zip";
const PROJECTS_ADMIN_PHP = "admin.php";

$adjectives = [
    "brave", "silent", "cosmic", "sunny", "misty", "electric", "gentle", "swift", "bright", "hidden",
    "lucky", "neon", "crimson", "mellow", "sparkly", "wild", "sleepy", "rapid", "glowing", "frosty",
    "curious", "bold", "playful", "stellar", "tidy", "velvet", "golden", "lunar", "cobalt", "amber",
    "silver", "dusky", "vivid", "quiet", "sunset", "ancient", "vibrant", "breezy", "lively", "shy",
    "proud", "patient", "whispering", "soaring", "crisp", "sandy", "gleaming", "magic", "jolly",
    "pearly", "plucky", "radiant", "rusty", "scarlet", "steady", "stormy", "sweet", "nimble",
    "twinkling", "mystic", "earthy", "dreamy", "citrus", "striped", "silky", "violet", "sunlit",
    "wooden", "coral", "opal", "icy", "salty", "fresh", "calm", "dapper", "minty", "royal",
    "brisk", "teal", "lavish", "glossy", "bubbly", "snappy", "daring", "blooming", "harmonic",
];
$nouns = [
    "llama", "fox", "beast", "otter", "raven", "comet", "river", "forest", "ember", "shadow",
    "aurora", "meadow", "whale", "falcon", "breeze", "summit", "orchid", "monarch", "lagoon", "quartz",
    "nebula", "canyon", "panda", "harbor", "voyage", "meerkat", "blossom", "galaxy", "island", "trail",
    "cove", "brook", "tide", "reef", "maple", "cabin", "tower", "garden", "marsh", "grove",
    "ridge", "harvest", "lantern", "compass", "drift", "glade", "prairie", "valley", "horizon",
    "spruce", "spark", "mirror", "meadowlark", "spirit", "sprout", "fern", "rocket", "orbit",
    "thunder", "pebble", "pavilion", "studio", "signal", "cicada", "firefly", "ripple", "creek",
    "eagle", "owl", "robin", "tiger", "panther", "lighthouse", "workshop", "dune", "cascade",
    "voyager", "paradox", "weaver", "composer", "harvester", "sentinel", "atlas", "keystone",
];

$projectsRoot = PROJECTS_ROOT;
$tempRoot = sys_get_temp_dir();
$adminTemplatePath = __DIR__ . "/admin_template.php";
$projectsAdminTemplatePath = __DIR__ . "/projects_admin_template.php";
$blockedNames = [".htaccess", ".htpasswd", ".user.ini"];
$blockedSegments = [".well-known"];
$allowedExtensions = [
    "html", "htm", "css", "js", "json", "txt", "md",
    "png", "jpg", "jpeg", "gif", "webp", "svg", "ico",
    "mp3", "wav", "mp4", "webm", "ogg",
];

function fail(string $message, int $status = 400): void {
    http_response_code($status);
    echo json_encode(["ok" => false, "error" => $message], JSON_UNESCAPED_SLASHES);
    exit;
}

function normalizePath(string $path): string {
    $path = str_replace("\\", "/", $path);
    $path = preg_replace("#/+#", "/", $path);
    return $path ?? "";
}

function isHiddenPath(string $path): bool {
    $trimmed = trim($path, "/");
    if ($trimmed === "") {
        return false;
    }
    foreach (explode("/", $trimmed) as $segment) {
        if ($segment !== "" && $segment[0] === ".") {
            return true;
        }
    }
    return false;
}

function validatePath(string $path, array $blockedNames, array $blockedSegments): string {
    $normalized = normalizePath($path);
    if ($normalized === "") {
        fail("Empty file path.");
    }
    if (strlen($normalized) > MAX_PATH_LENGTH) {
        fail("File path too long.");
    }
    if ($normalized[0] === "/") {
        fail("Absolute paths are not allowed.");
    }
    if (strpos($normalized, "..") !== false) {
        fail("Parent paths are not allowed.");
    }
    if (isHiddenPath($normalized)) {
        fail("Hidden files are not allowed.");
    }
    foreach ($blockedSegments as $segment) {
        if (strpos("/" . $normalized . "/", "/" . $segment . "/") !== false) {
            fail("Blocked path segment.");
        }
    }
    $basename = basename($normalized);
    foreach ($blockedNames as $blocked) {
        if (strcasecmp($basename, $blocked) === 0) {
            fail("Blocked filename.");
        }
    }
    return $normalized;
}

function ensureDir(string $path): void {
    if (!is_dir($path) && !mkdir($path, 0755, true)) {
        fail("Failed to create directory.", 500);
    }
}

function moveDirectory(string $source, string $destination): void {
    if (@rename($source, $destination)) {
        return;
    }
    ensureDir($destination);
    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($items as $item) {
        $target = $destination . "/" . $items->getSubPathName();
        if ($item->isDir()) {
            ensureDir($target);
        } else {
            if (!copy($item->getPathname(), $target)) {
                fail("Failed to move files.", 500);
            }
        }
    }
    $cleanup = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($cleanup as $item) {
        if ($item->isDir()) {
            @rmdir($item->getPathname());
        } else {
            @unlink($item->getPathname());
        }
    }
    @rmdir($source);
}

function sanitizeMeta(?string $value, int $maxLength = 140): string {
    $trimmed = trim((string) $value);
    if ($trimmed === "") {
        return "";
    }
    $length = function_exists("mb_strlen") ? mb_strlen($trimmed) : strlen($trimmed);
    if ($length > $maxLength) {
        return function_exists("mb_substr")
            ? mb_substr($trimmed, 0, $maxLength)
            : substr($trimmed, 0, $maxLength);
    }
    return $trimmed;
}


function createZipFromDir(string $source, string $zipPath, array $skipFiles): void {
    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        fail("Failed to create remix archive.", 500);
    }
    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($items as $item) {
        $relative = $items->getSubPathName();
        $basename = basename($relative);
        if (in_array($basename, $skipFiles, true)) {
            continue;
        }
        if ($item->isDir()) {
            $zip->addEmptyDir($relative);
        } else {
            $zip->addFile($item->getPathname(), $relative);
        }
    }
    $zip->close();
}

function generateSlug(array $adjectives, array $nouns, string $projectsRoot): string {
    $maxAttempts = 20;
    for ($i = 0; $i < $maxAttempts; $i++) {
        $adj = $adjectives[random_int(0, count($adjectives) - 1)];
        $noun = $nouns[random_int(0, count($nouns) - 1)];
        $slug = $adj . "-" . $noun;
        if (!file_exists($projectsRoot . "/" . $slug)) {
            return $slug;
        }
    }
    return bin2hex(random_bytes(4));
}

function injectRemixFab(string $projectDir): void {
  $snippet = "\n<!-- remix-fab -->\n"
      . "<a href=\"admin.php\" class=\"admin-fab\" data-admin-fab>Admin</a>\n"
      . "<a href=\"" . REMIX_ZIP_NAME . "\" class=\"remix-fab\" data-remix-fab download>Remix</a>\n"
      . "<style>\n"
      . ".remix-fab,.admin-fab{position:fixed;right:20px;z-index:9999;"
      . "padding:12px 16px;border-radius:999px;color:#fff;"
      . "font:600 14px/1.1 Arial,sans-serif;text-decoration:none;"
      . "box-shadow:0 10px 24px rgba(255,92,173,0.35);}\n"
      . ".admin-fab{bottom:80px;background:#3b2d72;box-shadow:0 10px 24px rgba(59,45,114,0.35);}\n"
      . ".remix-fab{bottom:30px;background:#ff5cad;}\n"
      . ".admin-fab:hover,.remix-fab:hover{transform:translateY(-2px);}\n"
      . "</style>\n";
    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($projectDir, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($items as $item) {
        if ($item->isDir()) {
            continue;
        }
        $ext = strtolower(pathinfo($item->getFilename(), PATHINFO_EXTENSION));
        if (!in_array($ext, ["html", "htm"], true)) {
            continue;
        }
        $path = $item->getPathname();
        $contents = file_get_contents($path);
        if ($contents === false || strpos($contents, "data-remix-fab") !== false) {
            continue;
        }
        $pos = stripos($contents, "</body>");
        if ($pos !== false) {
            $contents = substr($contents, 0, $pos) . $snippet . substr($contents, $pos);
        } else {
            $contents .= $snippet;
        }
        file_put_contents($path, $contents);
    }
}

function writeAdminDashboard(string $projectDir, string $templatePath): void {
    if (!file_exists($templatePath)) {
        fail("Missing admin template.", 500);
    }
    $template = file_get_contents($templatePath);
    if ($template === false) {
        fail("Failed to read admin template.", 500);
    }
    file_put_contents($projectDir . "/admin.php", $template);
}

function writeProjectsAdminDashboard(string $projectsRoot, string $templatePath): void {
    if (!file_exists($templatePath)) {
        fail("Missing projects admin template.", 500);
    }
    $template = file_get_contents($templatePath);
    if ($template === false) {
        fail("Failed to read projects admin template.", 500);
    }
    file_put_contents($projectsRoot . "/" . PROJECTS_ADMIN_PHP, $template);
}

function uploadErrorMessage(int $code): string {
    switch ($code) {
        case UPLOAD_ERR_INI_SIZE:
            return "Upload exceeded server limit (upload_max_filesize).";
        case UPLOAD_ERR_FORM_SIZE:
            return "Upload exceeded form limit.";
        case UPLOAD_ERR_PARTIAL:
            return "Upload incomplete.";
        case UPLOAD_ERR_NO_FILE:
            return "No file uploaded.";
        case UPLOAD_ERR_NO_TMP_DIR:
            return "Missing temporary folder on server.";
        case UPLOAD_ERR_CANT_WRITE:
            return "Failed to write upload to disk.";
        case UPLOAD_ERR_EXTENSION:
            return "Upload stopped by a PHP extension.";
        default:
            return "Upload failed.";
    }
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    fail("Method not allowed.", 405);
}

$user = currentUser();
if (!$user) {
    fail("Login required.", 401);
}
if (!in_array($user["role"], ["editor", "manager"], true)) {
    fail("Permission denied.", 403);
}
if (!csrfIsValid()) {
    fail("Invalid request token. Reload and try again.", 403);
}

if (empty($_FILES["zip"])) {
    fail("Missing zip file.");
}

if (!class_exists("ZipArchive")) {
    fail("ZipArchive extension is not available.", 500);
}

if (!isset($_FILES["zip"]["size"]) || $_FILES["zip"]["size"] > MAX_ZIP_BYTES) {
    fail("Zip file too large.");
}

if ($_FILES["zip"]["error"] !== UPLOAD_ERR_OK) {
    fail(uploadErrorMessage((int) $_FILES["zip"]["error"]));
}

ensureDir($projectsRoot);
ensureDir($tempRoot);

$zipPath = $_FILES["zip"]["tmp_name"] ?? "";
$zip = new ZipArchive();
if ($zip->open($zipPath) !== true) {
    fail("Invalid zip file.");
}

$totalSize = 0;
$fileCount = 0;
$entries = [];

for ($i = 0; $i < $zip->numFiles; $i++) {
    $stat = $zip->statIndex($i);
    if (!$stat || !isset($stat["name"])) {
        continue;
    }
    $name = (string) $stat["name"];
    $normalized = validatePath($name, $blockedNames, $blockedSegments);
    $isDir = substr($normalized, -1) === "/";
    $normalized = rtrim($normalized, "/");
    if ($isDir) {
        $entries[] = ["path" => rtrim($normalized, "/"), "dir" => true, "size" => 0, "index" => $i];
        continue;
    }
    $extension = strtolower(pathinfo($normalized, PATHINFO_EXTENSION));
    if ($extension === "" || !in_array($extension, $allowedExtensions, true)) {
        fail("File type not allowed.");
    }
    $size = isset($stat["size"]) ? (int) $stat["size"] : 0;
    $totalSize += $size;
    $fileCount++;
    if ($fileCount > MAX_FILE_COUNT) {
        fail("Too many files.");
    }
    if ($totalSize > MAX_EXTRACTED_BYTES) {
        fail("Project too large.");
    }
    $entries[] = ["path" => $normalized, "dir" => false, "size" => $size, "index" => $i];
}

$tempDir = $tempRoot . "/glitchlet_" . bin2hex(random_bytes(8));
ensureDir($tempDir);

foreach ($entries as $entry) {
    $targetPath = $tempDir . "/" . $entry["path"];
    if ($entry["dir"]) {
        ensureDir($targetPath);
        continue;
    }
    ensureDir(dirname($targetPath));
    $read = $zip->getStream($entry["path"]);
    if ($read === false) {
        fail("Failed to read zip contents.");
    }
    $write = fopen($targetPath, "wb");
    if ($write === false) {
        fail("Failed to write extracted file.", 500);
    }
    $copied = stream_copy_to_stream($read, $write);
    fclose($read);
    fclose($write);
    if ($copied === false || $copied !== $entry["size"]) {
        fail("Failed to extract file.");
    }
}

$zip->close();

$slug = generateSlug($adjectives, $nouns, $projectsRoot);
$destination = $projectsRoot . "/" . $slug;

moveDirectory($tempDir, $destination);

injectRemixFab($destination);
writeAdminDashboard($destination, $adminTemplatePath);
createZipFromDir($destination, $destination . "/" . REMIX_ZIP_NAME, ["admin.php", "project.json", REMIX_ZIP_NAME]);

$projectName = sanitizeMeta($_POST["name"] ?? "", 120);
if ($projectName === "") {
    $projectName = "Untitled Project";
}
$projectCreator = sanitizeMeta($_POST["creator"] ?? "", 80);
$projectDescription = sanitizeMeta($_POST["description"] ?? "", 240);

$publishedAt = time();
$metadata = [
    "slug" => $slug,
    "name" => $projectName,
    "description" => $projectDescription,
    "author" => $projectCreator,
    "creator" => $projectCreator,
    "archived" => false,
    "published_at" => $publishedAt,
    "updated_at" => $publishedAt,
    "url" => PROJECT_URL_BASE . $slug . "/",
];

$pdo = db();
$stmt = $pdo->prepare(
    "INSERT INTO projects (slug, name, description, author, creator, owner_user_id, archived, published_at, updated_at, url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
$stmt->execute([
    $metadata["slug"],
    $metadata["name"],
    $metadata["description"],
    $metadata["author"],
    $metadata["creator"],
    (int) $user["id"],
    0,
    $metadata["published_at"],
    $metadata["updated_at"],
    $metadata["url"],
]);

writeProjectJson($destination, $metadata);
writeProjectsIndex($pdo);
writeProjectsAdminDashboard($projectsRoot, $projectsAdminTemplatePath);

echo json_encode([
    "ok" => true,
    "slug" => $slug,
    "url" => PROJECT_URL_BASE . $slug . "/",
], JSON_UNESCAPED_SLASHES);
