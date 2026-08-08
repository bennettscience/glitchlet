<?php
declare(strict_types=1);

const LOGIN_ATTEMPT_WINDOW = 900; // 15 minutes
const LOGIN_MAX_PER_EMAIL = 5;
const LOGIN_MAX_PER_IP = 20;

function ensureLoginAttemptsTable(PDO $pdo): void {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS login_attempts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(190) NOT NULL,
          ip VARCHAR(45) NOT NULL DEFAULT '',
          attempted_at INT NOT NULL,
          INDEX idx_attempts_email (email, attempted_at),
          INDEX idx_attempts_ip (ip, attempted_at)
        )"
    );
}

function loginIsRateLimited(PDO $pdo, string $email, string $ip): bool {
    $cutoff = time() - LOGIN_ATTEMPT_WINDOW;

    // Opportunistically prune old rows so the table stays small.
    $pdo->prepare("DELETE FROM login_attempts WHERE attempted_at < ?")->execute([$cutoff]);

    $stmt = $pdo->prepare("SELECT COUNT(*) AS count FROM login_attempts WHERE email = ? AND attempted_at >= ?");
    $stmt->execute([$email, $cutoff]);
    if ((int) ($stmt->fetch()["count"] ?? 0) >= LOGIN_MAX_PER_EMAIL) {
        return true;
    }

    if ($ip !== "") {
        $stmt = $pdo->prepare("SELECT COUNT(*) AS count FROM login_attempts WHERE ip = ? AND attempted_at >= ?");
        $stmt->execute([$ip, $cutoff]);
        if ((int) ($stmt->fetch()["count"] ?? 0) >= LOGIN_MAX_PER_IP) {
            return true;
        }
    }

    return false;
}

function recordFailedLogin(PDO $pdo, string $email, string $ip): void {
    $stmt = $pdo->prepare("INSERT INTO login_attempts (email, ip, attempted_at) VALUES (?, ?, ?)");
    $stmt->execute([$email, $ip, time()]);
}

function clearFailedLogins(PDO $pdo, string $email): void {
    $pdo->prepare("DELETE FROM login_attempts WHERE email = ?")->execute([$email]);
}
