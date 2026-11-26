<?php
// Noor progress sync. Sign in with a Google ID token, then read and write one JSON document per Google account.
//
//   POST ?a=login   {credential}       verify the Google sign-in, start a session cookie
//   GET  ?a=me                          who is signed in (or 401)
//   GET  ?a=data                        { data, rev }
//   PUT  ?a=data    { data, rev }       save if rev still matches; otherwise 409 with the current copy
//   POST ?a=logout                      end this session
//   POST ?a=delete                      delete the account's synced data and all its sessions
//
// Requests that change anything must send the header "X-Noor: 1"; browsers do not let other sites add it,
// which together with the SameSite cookie protects against cross-site requests.

declare(strict_types=1);
$cfg = require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function out(int $code, array $body): void { http_response_code($code); echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function fail(int $code, string $err): void { out($code, ['error' => $err]); }

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['a'] ?? '';

// only this site may call us
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !in_array($origin, $cfg['origins'], true)) fail(403, 'origin');
if ($method !== 'GET' && ($_SERVER['HTTP_X_NOOR'] ?? '') !== '1') fail(403, 'header');

/* ---------- storage ---------- */
function db(array $cfg): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $dir = dirname($cfg['db_path']);
    if (!is_dir($dir) || !is_writable($dir)) fail(503, 'storage');      // the server folder is not set up yet
    $pdo = new PDO('sqlite:' . $cfg['db_path'], null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 4000; PRAGMA foreign_keys = ON;');
    $pdo->exec('CREATE TABLE IF NOT EXISTS users (sub TEXT PRIMARY KEY, email TEXT, name TEXT, picture TEXT, created INTEGER, seen INTEGER)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, sub TEXT NOT NULL REFERENCES users(sub) ON DELETE CASCADE, created INTEGER, expires INTEGER)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS docs (sub TEXT PRIMARY KEY REFERENCES users(sub) ON DELETE CASCADE, body TEXT NOT NULL, rev INTEGER NOT NULL, updated INTEGER)');
    return $pdo;
}

/* ---------- Google sign-in ---------- */
function verify_google(string $idToken, array $cfg): array {
    if (isset($cfg['test_verifier']) && is_callable($cfg['test_verifier'])) return ($cfg['test_verifier'])($idToken);   // local tests only
    if (!preg_match('/^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/', $idToken)) fail(401, 'token');
    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken);
    $raw = false;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_SSL_VERIFYPEER => true]);
        $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code !== 200) $raw = false;
    } else {
        $raw = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 8]]));
    }
    $t = $raw ? json_decode($raw, true) : null;
    if (!is_array($t)) fail(401, 'token');
    $okIss = in_array($t['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true);
    if (!$okIss || ($t['aud'] ?? '') !== $cfg['google_client_id'] || (int)($t['exp'] ?? 0) < time() || empty($t['sub'])) fail(401, 'token');
    if (($t['email_verified'] ?? '') !== 'true' && ($t['email_verified'] ?? false) !== true) fail(401, 'email');
    return ['sub' => (string)$t['sub'], 'email' => (string)($t['email'] ?? ''), 'name' => (string)($t['name'] ?? ''), 'picture' => (string)($t['picture'] ?? '')];
}

/* ---------- sessions ---------- */
function cookie_path(): string {
    $p = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/sync.php'))), '/');
    return $p . '/';
}
function is_https(): bool { return ($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'; }
function set_cookie(string $value, int $expires): void {
    setcookie('noor_sid', $value, ['expires' => $expires, 'path' => cookie_path(), 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Lax']);
}
function current_user(array $cfg): ?array {
    $sid = $_COOKIE['noor_sid'] ?? '';
    if (!preg_match('/^[a-f0-9]{64}$/', $sid)) return null;
    $q = db($cfg)->prepare('SELECT u.* FROM sessions s JOIN users u ON u.sub = s.sub WHERE s.hash = ? AND s.expires > ?');
    $q->execute([hash('sha256', $sid), time()]);
    $u = $q->fetch(PDO::FETCH_ASSOC);
    return $u ?: null;
}
function need_user(array $cfg): array { $u = current_user($cfg); if (!$u) fail(401, 'signin'); return $u; }
function public_user(array $u): array { return ['email' => $u['email'], 'name' => $u['name'], 'picture' => $u['picture']]; }
function body(array $cfg): array {
    $raw = file_get_contents('php://input', false, null, 0, $cfg['max_bytes'] + 1);
    if ($raw === false || strlen($raw) > $cfg['max_bytes']) fail(413, 'too_large');
    $j = json_decode($raw, true);
    if (!is_array($j)) fail(400, 'json');
    return $j;
}

/* ---------- routes ---------- */
try {
    if ($action === 'login' && $method === 'POST') {
        $b = body($cfg);
        $g = verify_google((string)($b['credential'] ?? ''), $cfg);
        $pdo = db($cfg); $now = time();
        $pdo->prepare('INSERT INTO users (sub, email, name, picture, created, seen) VALUES (?, ?, ?, ?, ?, ?)
                       ON CONFLICT(sub) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture, seen = excluded.seen')
            ->execute([$g['sub'], $g['email'], $g['name'], $g['picture'], $now, $now]);
        $sid = bin2hex(random_bytes(32)); $exp = $now + $cfg['session_days'] * 86400;
        $pdo->prepare('INSERT INTO sessions (hash, sub, created, expires) VALUES (?, ?, ?, ?)')->execute([hash('sha256', $sid), $g['sub'], $now, $exp]);
        $pdo->prepare('DELETE FROM sessions WHERE expires < ?')->execute([$now]);
        set_cookie($sid, $exp);
        out(200, ['user' => public_user($g)]);
    }

    if ($action === 'me' && $method === 'GET') {
        $u = current_user($cfg);
        if (!$u) fail(401, 'signin');
        db($cfg)->prepare('UPDATE users SET seen = ? WHERE sub = ?')->execute([time(), $u['sub']]);
        out(200, ['user' => public_user($u)]);
    }

    if ($action === 'data' && $method === 'GET') {
        $u = need_user($cfg);
        $q = db($cfg)->prepare('SELECT body, rev, updated FROM docs WHERE sub = ?'); $q->execute([$u['sub']]);
        $d = $q->fetch(PDO::FETCH_ASSOC);
        out(200, $d ? ['data' => json_decode($d['body'], true), 'rev' => (int)$d['rev'], 'updated' => (int)$d['updated']] : ['data' => null, 'rev' => 0, 'updated' => 0]);
    }

    if ($action === 'data' && $method === 'PUT') {
        $u = need_user($cfg); $b = body($cfg);
        if (!isset($b['data']) || !is_array($b['data']) || !isset($b['rev']) || !is_int($b['rev'])) fail(400, 'shape');
        $pdo = db($cfg);
        $pdo->beginTransaction();
        $q = $pdo->prepare('SELECT body, rev FROM docs WHERE sub = ?'); $q->execute([$u['sub']]);
        $cur = $q->fetch(PDO::FETCH_ASSOC);
        $curRev = $cur ? (int)$cur['rev'] : 0;
        if ($b['rev'] !== $curRev) {      // another device saved first: send its copy back to be merged
            $pdo->rollBack();
            out(409, ['data' => $cur ? json_decode($cur['body'], true) : null, 'rev' => $curRev]);
        }
        $json = json_encode($b['data'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $now = time(); $rev = $curRev + 1;
        $pdo->prepare('INSERT INTO docs (sub, body, rev, updated) VALUES (?, ?, ?, ?)
                       ON CONFLICT(sub) DO UPDATE SET body = excluded.body, rev = excluded.rev, updated = excluded.updated')
            ->execute([$u['sub'], $json, $rev, $now]);
        $pdo->commit();
        out(200, ['rev' => $rev, 'updated' => $now]);
    }

    if ($action === 'logout' && $method === 'POST') {
        $sid = $_COOKIE['noor_sid'] ?? '';
        if (preg_match('/^[a-f0-9]{64}$/', $sid)) db($cfg)->prepare('DELETE FROM sessions WHERE hash = ?')->execute([hash('sha256', $sid)]);
        set_cookie('', 1);
        out(200, ['ok' => true]);
    }

    if ($action === 'delete' && $method === 'POST') {
        $u = need_user($cfg);
        db($cfg)->prepare('DELETE FROM users WHERE sub = ?')->execute([$u['sub']]);   // sessions and data go with it
        set_cookie('', 1);
        out(200, ['ok' => true]);
    }

    fail(404, 'action');
} catch (Throwable $e) {
    error_log('noor sync: ' . $e->getMessage());
    fail(500, 'server');
}
