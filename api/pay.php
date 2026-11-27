<?php
// Razorpay webhook: records Noor full-access payments made on the two Razorpay Payment Pages
// (₹49 and $2.99) and unlocks the Google account with the same email. A payment made with another
// email can be claimed later from the app with its payment ID (sync.php ?a=claim).
//
// Razorpay dashboard → Developers → Webhooks: URL https://smahfuzm.in/quran-noor/api/pay.php,
// events payment.captured and refund.processed, and a secret that is also saved on the server in
// the file named by config 'rzp_webhook_secret_file'. Without that file every call is refused.

declare(strict_types=1);
define('NOOR_PAY', true);
require __DIR__ . '/lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); exit('{"error":"method"}'); }

$secretFile = $cfg['rzp_webhook_secret_file'];
$secret = is_readable($secretFile) ? trim((string)file_get_contents($secretFile)) : '';
if ($secret === '') { http_response_code(503); exit('{"error":"not configured"}'); }

$raw = file_get_contents('php://input', false, null, 0, 512 * 1024);
$sig = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';
if (!is_string($raw) || $raw === '' || !hash_equals(hash_hmac('sha256', $raw, $secret), $sig)) {
    http_response_code(400); exit('{"error":"signature"}');
}
$ev = json_decode($raw, true);
if (!is_array($ev)) { http_response_code(400); exit('{"error":"json"}'); }

$event = (string)($ev['event'] ?? '');
$p = $ev['payload']['payment']['entity'] ?? null;
try {
    if ($event === 'payment.captured' && is_array($p)) {
        $amount = (int)($p['amount'] ?? 0); $currency = (string)($p['currency'] ?? '');
        // only the Noor prices count (other products on the same Razorpay account are ignored)
        $ok = false;
        foreach ($cfg['prices'] as $pr) if ($pr[0] === $currency && $pr[1] === $amount) $ok = true;
        if (!$ok) { echo '{"ok":true,"ignored":"amount"}'; exit; }
        record_payment(db($cfg), $p, 'captured');
        echo '{"ok":true}'; exit;
    }
    if ($event === 'refund.processed' || $event === 'payment.refunded') {
        $pid = (string)($ev['payload']['refund']['entity']['payment_id'] ?? ($p['id'] ?? ''));
        if ($pid !== '') revoke_payment(db($cfg), $pid);
        echo '{"ok":true}'; exit;
    }
    echo '{"ok":true,"ignored":"event"}';
} catch (Throwable $e) {
    error_log('noor pay: ' . $e->getMessage());
    http_response_code(500); echo '{"error":"server"}';
}
