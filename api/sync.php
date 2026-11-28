<?php
// Noor progress sync. Sign in with a Google ID token, then read and write one JSON document per Google account.
//
//   POST ?a=login   {credential}       verify the Google sign-in, start a session cookie
//   GET  ?a=me                          who is signed in (or 401)
//   GET  ?a=data                        { data, rev }
//   PUT  ?a=data    { data, rev }       save if rev still matches; otherwise 409 with the current copy
//   GET  ?a=nonce                       one-time code for redirect sign-in (also set as a cookie)
//   POST api/gsi.php                    Google sends the redirect sign-in here, then the page is reopened
//   POST ?a=logout                      end this session
//   POST ?a=delete                      delete the account's synced data and all its sessions
//   POST ?a=claim   {payment_id}        unlock full access with a Razorpay payment made under another email
//   GET  ?a=admin                       (admins) free-access emails and payments
//   POST ?a=admin_add {email, note}     (admins) give an email full access without payment
//   POST ?a=admin_remove {email}        (admins) take it away again
//
// Requests that change anything must send the header "X-Noor: 1"; browsers do not let other sites add it,
// which together with the SameSite cookie protects against cross-site requests.

declare(strict_types=1);
require __DIR__ . '/lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function out(int $code, array $body): void { http_response_code($code); echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function fail(int $code, string $err): void {
    if (defined('NOOR_GSI')) back_to_app('fail');        // redirect sign-in: return to the page, not JSON
    out($code, ['error' => $err]);
}
function back_to_app(string $result): void {
    header('Location: ' . cookie_path() . '?signin=' . $result . '#/progress', true, 303);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['a'] ?? '';

if (defined('NOOR_GSI')) { gsi_return($cfg); }

// only this site may call us
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !in_array($origin, $cfg['origins'], true)) fail(403, 'origin');
if ($method !== 'GET' && ($_SERVER['HTTP_X_NOOR'] ?? '') !== '1') fail(403, 'header');

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
    return ['sub' => (string)$t['sub'], 'email' => (string)($t['email'] ?? ''), 'name' => (string)($t['name'] ?? ''), 'picture' => (string)($t['picture'] ?? ''), 'nonce' => (string)($t['nonce'] ?? '')];
}

/** Save the user and start a session for them. */
function start_session(array $g, array $cfg): void {
    $pdo = db($cfg); $now = time();
    $pdo->prepare('INSERT INTO users (sub, email, name, picture, created, seen) VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(sub) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture, seen = excluded.seen')
        ->execute([$g['sub'], $g['email'], $g['name'], $g['picture'], $now, $now]);
    $sid = bin2hex(random_bytes(32)); $exp = $now + $cfg['session_days'] * 86400;
    $pdo->prepare('INSERT INTO sessions (hash, sub, created, expires) VALUES (?, ?, ?, ?)')->execute([hash('sha256', $sid), $g['sub'], $now, $exp]);
    $pdo->prepare('DELETE FROM sessions WHERE expires < ?')->execute([$now]);
    set_cookie($sid, $exp);
    link_payments_by_email($pdo, $g['sub'], $g['email']);
}

/* ---------- redirect sign-in ----------
   The page asks for a one-time code (?a=nonce), which is also stored in a cookie only this browser has.
   Google puts the code inside the signed sign-in token and posts it to api/gsi.php. A match proves the sign-in
   was started from this browser, so another site cannot sign someone into a different account. */
function nonce_cookie(string $value, int $expires): void {
    setcookie('noor_nonce', $value, ['expires' => $expires, 'path' => cookie_path() . 'api/', 'secure' => true, 'httponly' => true, 'samesite' => 'None']);
}
function gsi_return(array $cfg): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') back_to_app('fail');
    $csrfCookie = $_COOKIE['g_csrf_token'] ?? null;
    if ($csrfCookie !== null && !hash_equals((string)$csrfCookie, (string)($_POST['g_csrf_token'] ?? ''))) back_to_app('fail');
    $g = verify_google((string)($_POST['credential'] ?? ''), $cfg);
    $nonce = (string)($_COOKIE['noor_nonce'] ?? '');
    if (!preg_match('/^[a-f0-9]{32}$/', $nonce) || !hash_equals($nonce, $g['nonce'])) back_to_app('fail');
    nonce_cookie('', 1);
    start_session($g, $cfg);
    back_to_app('ok');
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
function public_user(array $u, array $cfg = []): array {
    $out = ['email' => $u['email'], 'name' => $u['name'], 'picture' => $u['picture']];
    if ($cfg && !empty($u['sub'])) $out['pro'] = is_pro(db($cfg), (string)$u['sub']);
    if ($cfg && is_admin($cfg, $u)) $out['admin'] = true;
    return $out;
}
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
        start_session($g, $cfg);
        out(200, ['user' => public_user($g, $cfg)]);
    }

    if ($action === 'nonce' && $method === 'GET') {
        $n = bin2hex(random_bytes(16));
        nonce_cookie($n, time() + 1800);
        out(200, ['nonce' => $n]);
    }

    if ($action === 'me' && $method === 'GET') {
        $u = current_user($cfg);
        if (!$u) fail(401, 'signin');
        db($cfg)->prepare('UPDATE users SET seen = ? WHERE sub = ?')->execute([time(), $u['sub']]);
        link_payments_by_email(db($cfg), $u['sub'], (string)$u['email']);
        out(200, ['user' => public_user($u, $cfg)]);
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

    // public: are payments set up? The app only locks tools once the Razorpay webhook secret is on the server.
    /* ---------- admin ---------- */
    if (in_array($action, ['admin', 'admin_add', 'admin_remove'], true)) {
        $u = need_user($cfg);
        if (!is_admin($cfg, $u)) fail(403, 'admin');
        $pdo = db($cfg);
        if ($action === 'admin_add' && $method === 'POST') {
            $b = body($cfg);
            $email = norm_email((string)($b['email'] ?? ''));
            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 200) fail(400, 'email');
            $note = mb_substr(trim((string)($b['note'] ?? '')), 0, 120);
            $pdo->prepare('INSERT INTO grants (email, note, added_by, created) VALUES (?, ?, ?, ?)
                           ON CONFLICT(email) DO UPDATE SET note = excluded.note')->execute([$email, $note, norm_email((string)$u['email']), time()]);
        } elseif ($action === 'admin_remove' && $method === 'POST') {
            $b = body($cfg);
            $pdo->prepare('DELETE FROM grants WHERE email = ?')->execute([norm_email((string)($b['email'] ?? ''))]);
        } elseif ($method !== 'GET') fail(405, 'method');
        $grants = $pdo->query('SELECT g.email, g.note, g.added_by, g.created, (SELECT max(seen) FROM users u WHERE lower(u.email) = g.email) AS seen FROM grants g ORDER BY g.created DESC')->fetchAll(PDO::FETCH_ASSOC);
        $pays = $pdo->query('SELECT p.id, p.email, p.amount, p.currency, p.status, p.created, (SELECT email FROM users u WHERE u.sub = p.sub) AS account FROM payments p ORDER BY p.created DESC LIMIT 5000')->fetchAll(PDO::FETCH_ASSOC);
        $counts = ['users' => (int)$pdo->query('SELECT count(*) FROM users')->fetchColumn()];
        $users = $pdo->query("SELECT u.email, u.name, u.created, u.seen,
              EXISTS(SELECT 1 FROM payments p WHERE p.sub = u.sub AND p.status = 'captured') AS paid,
              EXISTS(SELECT 1 FROM grants g WHERE g.email = lower(u.email)) AS granted,
              (SELECT d.updated FROM docs d WHERE d.sub = u.sub) AS synced
            FROM users u ORDER BY u.seen DESC LIMIT 5000")->fetchAll(PDO::FETCH_ASSOC);
        out(200, ['grants' => $grants, 'payments' => $pays, 'users' => $users, 'counts' => $counts]);
    }

    if ($action === 'paywall' && $method === 'GET') {
        $f = $cfg['rzp_webhook_secret_file'];
        out(200, ['ready' => is_readable($f) && trim((string)file_get_contents($f)) !== '']);
    }

    if ($action === 'claim' && $method === 'POST') {
        $u = need_user($cfg); $b = body($cfg);
        $pid = trim((string)($b['payment_id'] ?? ''));
        if (!preg_match('/^pay_[A-Za-z0-9]{8,30}$/', $pid)) fail(400, 'payment_id');
        $pdo = db($cfg);
        $q = $pdo->prepare('SELECT sub, status FROM payments WHERE id = ?'); $q->execute([$pid]);
        $row = $q->fetch(PDO::FETCH_ASSOC);
        if (!$row) fail(404, 'unknown');                       // not (yet) reported by Razorpay
        if ($row['status'] !== 'captured') fail(409, 'refunded');
        if ($row['sub'] && $row['sub'] !== $u['sub']) fail(409, 'taken');
        $pdo->prepare('UPDATE payments SET sub = ? WHERE id = ? AND (sub IS NULL OR sub = ?)')->execute([$u['sub'], $pid, $u['sub']]);
        out(200, ['user' => public_user($u, $cfg)]);
    }

    fail(404, 'action');
} catch (Throwable $e) {
    error_log('noor sync: ' . $e->getMessage());
    fail(500, 'server');
}
