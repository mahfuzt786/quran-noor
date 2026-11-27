<?php
// Shared by sync.php and pay.php: settings, the SQLite database, and the full-access payment records.
declare(strict_types=1);
$cfg = require __DIR__ . '/config.php';

function db(array $cfg): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $dir = dirname($cfg['db_path']);
    if (!is_dir($dir) || !is_writable($dir)) {                     // the server folder is not set up yet
        if (function_exists('fail')) fail(503, 'storage');
        http_response_code(503); exit('{"error":"storage"}');
    }
    $pdo = new PDO('sqlite:' . $cfg['db_path'], null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 4000; PRAGMA foreign_keys = ON;');
    $pdo->exec('CREATE TABLE IF NOT EXISTS users (sub TEXT PRIMARY KEY, email TEXT, name TEXT, picture TEXT, created INTEGER, seen INTEGER)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, sub TEXT NOT NULL REFERENCES users(sub) ON DELETE CASCADE, created INTEGER, expires INTEGER)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS docs (sub TEXT PRIMARY KEY REFERENCES users(sub) ON DELETE CASCADE, body TEXT NOT NULL, rev INTEGER NOT NULL, updated INTEGER)');
    // Razorpay payments for full access. sub is the Google account it unlocks (NULL until matched or claimed).
    // Kept even if the account is deleted, so a refund or a later claim can still be checked.
    $pdo->exec('CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, email TEXT, contact TEXT, amount INTEGER, currency TEXT, status TEXT, created INTEGER, sub TEXT)');
    return $pdo;
}

function norm_email(string $e): string { return strtolower(trim($e)); }

/** Store a captured payment, and unlock the account with the same email if there is one. */
function record_payment(PDO $pdo, array $p, string $status): void {
    $id = (string)($p['id'] ?? ''); if (!preg_match('/^pay_[A-Za-z0-9]{8,30}$/', $id)) return;
    $email = norm_email((string)($p['email'] ?? ''));
    $pdo->prepare('INSERT INTO payments (id, email, contact, amount, currency, status, created, sub) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
                   ON CONFLICT(id) DO UPDATE SET status = excluded.status')
        ->execute([$id, $email, (string)($p['contact'] ?? ''), (int)($p['amount'] ?? 0), (string)($p['currency'] ?? ''), $status, (int)($p['created_at'] ?? time())]);
    if ($email !== '') {
        $q = $pdo->prepare('SELECT sub FROM users WHERE lower(email) = ? LIMIT 1'); $q->execute([$email]);
        $sub = $q->fetchColumn();
        if ($sub) $pdo->prepare('UPDATE payments SET sub = ? WHERE id = ? AND sub IS NULL')->execute([$sub, $id]);
    }
}

function revoke_payment(PDO $pdo, string $id): void {
    $pdo->prepare("UPDATE payments SET status = 'refunded' WHERE id = ?")->execute([$id]);
}

/** When someone signs in, pick up payments made earlier with their email. */
function link_payments_by_email(PDO $pdo, string $sub, string $email): void {
    $email = norm_email($email); if ($email === '') return;
    $pdo->prepare("UPDATE payments SET sub = ? WHERE sub IS NULL AND status = 'captured' AND lower(email) = ?")->execute([$sub, $email]);
}

function is_pro(PDO $pdo, string $sub): bool {
    $q = $pdo->prepare("SELECT 1 FROM payments WHERE sub = ? AND status = 'captured' LIMIT 1"); $q->execute([$sub]);
    return (bool)$q->fetchColumn();
}
