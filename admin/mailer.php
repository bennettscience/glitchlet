<?php
declare(strict_types=1);

require_once __DIR__ . "/config.php";

$SMTP_LAST_ERROR = "";

function smtpLastError(): string {
    global $SMTP_LAST_ERROR;
    return $SMTP_LAST_ERROR;
}

function smtpSetError(string $message): void {
    global $SMTP_LAST_ERROR;
    $SMTP_LAST_ERROR = $message;
}

function smtpSendMail(string $to, string $subject, string $body): bool {
    if (SMTP_ENABLED !== "1") {
        smtpSetError("SMTP is disabled.");
        return false;
    }
    $host = SMTP_HOST;
    $port = (int) SMTP_PORT;
    $user = SMTP_USER;
    $pass = SMTP_PASS;
    $from = SMTP_FROM ?: $user;
    if ($host === "" || $port === 0 || $user === "" || $pass === "" || $from === "") {
        smtpSetError("SMTP credentials are incomplete.");
        return false;
    }
    $fromName = SMTP_FROM_NAME !== "" ? SMTP_FROM_NAME : "Glitchlet";
    $secure = strtolower(SMTP_SECURE);
    $target = ($secure === "ssl" ? "ssl://" : "") . $host . ":" . $port;

    $fp = @stream_socket_client($target, $errno, $errstr, 10);
    if (!$fp) {
        smtpSetError("Connection failed: " . $errstr);
        return false;
    }
    stream_set_timeout($fp, 10);

    if (!smtpExpect($fp, ["220"])) {
        smtpSetError("SMTP greeting failed.");
        fclose($fp);
        return false;
    }

    smtpSend($fp, "EHLO glitchlet");
    if (!smtpExpect($fp, ["250"])) {
        smtpSetError("SMTP EHLO failed.");
        fclose($fp);
        return false;
    }

    if ($secure === "tls") {
        smtpSend($fp, "STARTTLS");
        if (!smtpExpect($fp, ["220"])) {
            smtpSetError("SMTP STARTTLS failed.");
            fclose($fp);
            return false;
        }
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            smtpSetError("SMTP TLS negotiation failed.");
            fclose($fp);
            return false;
        }
        smtpSend($fp, "EHLO glitchlet");
        if (!smtpExpect($fp, ["250"])) {
            smtpSetError("SMTP EHLO after TLS failed.");
            fclose($fp);
            return false;
        }
    }

    smtpSend($fp, "AUTH LOGIN");
    if (!smtpExpect($fp, ["334"])) {
        smtpSetError("SMTP AUTH not accepted.");
        fclose($fp);
        return false;
    }
    smtpSend($fp, base64_encode($user));
    if (!smtpExpect($fp, ["334"])) {
        smtpSetError("SMTP username rejected.");
        fclose($fp);
        return false;
    }
    smtpSend($fp, base64_encode($pass));
    if (!smtpExpect($fp, ["235"])) {
        smtpSetError("SMTP password rejected.");
        fclose($fp);
        return false;
    }

    smtpSend($fp, "MAIL FROM:<{$from}>");
    if (!smtpExpect($fp, ["250"])) {
        smtpSetError("SMTP MAIL FROM rejected.");
        fclose($fp);
        return false;
    }
    smtpSend($fp, "RCPT TO:<{$to}>");
    if (!smtpExpect($fp, ["250", "251"])) {
        smtpSetError("SMTP RCPT TO rejected.");
        fclose($fp);
        return false;
    }
    smtpSend($fp, "DATA");
    if (!smtpExpect($fp, ["354"])) {
        smtpSetError("SMTP DATA rejected.");
        fclose($fp);
        return false;
    }

    $headers = [];
    $headers[] = "From: " . $fromName . " <{$from}>";
    $headers[] = "To: <{$to}>";
    $headers[] = "Subject: " . $subject;
    $headers[] = "MIME-Version: 1.0";
    $headers[] = "Content-Type: text/plain; charset=UTF-8";

    $message = implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n.";
    smtpSend($fp, $message);
    if (!smtpExpect($fp, ["250"])) {
        smtpSetError("SMTP send failed.");
        fclose($fp);
        return false;
    }

    smtpSend($fp, "QUIT");
    fclose($fp);
    smtpSetError("");
    return true;
}

function smtpSend($fp, string $line): void {
    fwrite($fp, $line . "\r\n");
}

function smtpExpect($fp, array $codes): bool {
    $response = smtpReadResponse($fp);
    if ($response === "") {
        return false;
    }
    foreach ($codes as $code) {
        if (strpos($response, (string) $code) === 0) {
            return true;
        }
    }
    return false;
}

function smtpReadResponse($fp): string {
    $data = "";
    while (!feof($fp)) {
        $line = fgets($fp, 515);
        if ($line === false) {
            break;
        }
        $data .= $line;
        if (preg_match("/^\\d{3} /", $line)) {
            break;
        }
    }
    return trim($data);
}
