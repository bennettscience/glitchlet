<?php
declare(strict_types=1);

require_once __DIR__ . "/auth.php";

header("Content-Type: application/json");

function jsonFail(string $message, int $code = 400): void {
    http_response_code($code);
    echo json_encode(["ok" => false, "error" => $message]);
    exit;
}

function jsonOk(array $payload): void {
    echo json_encode(array_merge(["ok" => true], $payload));
    exit;
}

function readVersion(string $root): string {
    $versionPath = $root . "/VERSION";
    if (!file_exists($versionPath)) {
        return "0.0.0";
    }
    $raw = trim((string) file_get_contents($versionPath));
    return $raw === "" ? "0.0.0" : $raw;
}

function fetchJson(string $url): array {
    $raw = @file_get_contents($url);
    if ($raw === false) {
        jsonFail("Failed to fetch update manifest.");
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        jsonFail("Invalid update manifest JSON.");
    }
    return $decoded;
}

function ensureDir(string $path): void {
    if (!is_dir($path)) {
        mkdir($path, 0775, true);
    }
}

function recursiveCopy(string $src, string $dest, array $skip): void {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($src, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($iterator as $item) {
        $rel = ltrim(str_replace($src, "", $item->getPathname()), DIRECTORY_SEPARATOR);
        if ($rel === "") continue;
        foreach ($skip as $blocked) {
            if ($rel === $blocked || str_starts_with($rel, $blocked . DIRECTORY_SEPARATOR)) {
                continue 2;
            }
        }
        $target = $dest . DIRECTORY_SEPARATOR . $rel;
        if ($item->isDir()) {
            ensureDir($target);
        } else {
            ensureDir(dirname($target));
            copy($item->getPathname(), $target);
        }
    }
}

$user = currentUser();
if (!$user || ($user["role"] ?? "") !== "manager") {
    jsonFail("Permission denied.", 403);
}

$manifestUrl = defined("UPDATE_MANIFEST_URL") ? (string) UPDATE_MANIFEST_URL : "";
if ($manifestUrl === "") {
    jsonFail("Update manifest not configured.", 400);
}

$root = dirname(__DIR__);
$current = readVersion($root);

$manifest = fetchJson($manifestUrl);
$latest = (string) ($manifest["version"] ?? "");
$zipUrl = (string) ($manifest["zip_url"] ?? "");
$sha256 = (string) ($manifest["sha256"] ?? "");

if ($latest === "" || $zipUrl === "") {
    jsonFail("Update manifest missing required fields.");
}

$updateAvailable = version_compare($latest, $current, ">");

if ($_SERVER["REQUEST_METHOD"] === "GET") {
    jsonOk([
        "current" => $current,
        "latest" => $latest,
        "updateAvailable" => $updateAvailable,
        "notes" => $manifest["notes"] ?? "",
    ]);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    jsonFail("Method not allowed.", 405);
}

if (!csrfIsValid()) {
    jsonFail("Invalid request token.", 403);
}

if (!defined("UPDATE_ALLOW") || UPDATE_ALLOW !== "1") {
    jsonFail("Updates are disabled by server config.", 403);
}

if ($sha256 === "" || !preg_match("/^[0-9a-f]{64}$/i", $sha256)) {
    jsonFail("Update manifest must include a valid sha256 checksum.");
}

if (!str_starts_with($zipUrl, "https://")) {
    jsonFail("Update zip_url must use HTTPS.");
}

if (!$updateAvailable) {
    jsonOk([
        "current" => $current,
        "latest" => $latest,
        "message" => "Already up to date.",
    ]);
}

$tempRoot = sys_get_temp_dir() . "/glitchlet_update_" . bin2hex(random_bytes(6));
ensureDir($tempRoot);
$zipPath = $tempRoot . "/release.zip";

$zipData = @file_get_contents($zipUrl);
if ($zipData === false) {
    jsonFail("Failed to download update zip.");
}
file_put_contents($zipPath, $zipData);

$actual = hash_file("sha256", $zipPath);
if ($actual === false || !hash_equals(strtolower($sha256), strtolower($actual))) {
    jsonFail("Update checksum mismatch.");
}

$zip = new ZipArchive();
if ($zip->open($zipPath) !== true) {
    jsonFail("Invalid update zip.");
}
for ($i = 0; $i < $zip->numFiles; $i++) {
    $stat = $zip->statIndex($i);
    if (!$stat || !isset($stat["name"])) continue;
    $name = (string) $stat["name"];
    if (str_contains($name, "..")) {
        jsonFail("Invalid zip contents.");
    }
}
$zip->extractTo($tempRoot . "/extract");
$zip->close();

$sourceRoot = $tempRoot . "/extract";
if (!is_dir($sourceRoot)) {
    jsonFail("Failed to extract update.");
}

$skip = [
    "publish/config.php",
    "projects",
    "install.lock",
];

recursiveCopy($sourceRoot, $root, $skip);

jsonOk([
    "current" => $current,
    "latest" => $latest,
    "message" => "Update applied.",
]);
