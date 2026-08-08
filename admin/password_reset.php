<?php
declare(strict_types=1);

function createPasswordResetToken(PDO $pdo, int $userId, int $ttlSeconds = 172800): string {
    $token = bin2hex(random_bytes(32));
    $hash = hash("sha256", $token);
    $expires = time() + $ttlSeconds;
    $stmt = $pdo->prepare(
        "INSERT INTO password_resets (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)"
    );
    $stmt->execute([$userId, $hash, $expires, time()]);
    return $token;
}

function getPasswordReset(PDO $pdo, string $token): ?array {
    $hash = hash("sha256", $token);
    $stmt = $pdo->prepare(
        "SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ? LIMIT 1"
    );
    $stmt->execute([$hash]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    if (!empty($row["used_at"]) || (int) $row["expires_at"] < time()) {
        return null;
    }
    return $row;
}

function markPasswordResetUsed(PDO $pdo, int $resetId): void {
    $stmt = $pdo->prepare("UPDATE password_resets SET used_at = ? WHERE id = ?");
    $stmt->execute([time(), $resetId]);
}
