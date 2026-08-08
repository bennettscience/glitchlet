<?php
declare(strict_types=1);

// Stub written into each published project directory as admin.php.
// All real logic lives in publish/project_admin.php, so template changes
// take effect everywhere without regenerating these files.
$handler = dirname(__DIR__) . "/../admin/project_admin.php";
if (!is_file($handler)) {
    http_response_code(404);
    echo "Not found.";
    exit;
}
require $handler;
