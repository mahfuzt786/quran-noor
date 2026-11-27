<?php
// Razorpay webhook: records Noor full-access payments made on the two Razorpay Payment Pages
// (₹49 and $2.99) and unlocks the Google account with the same email. A payment made with another
// email can be claimed later from the app with its payment ID (sync.php ?a=claim).
//
// Razorpay dashboard → Developers → Webhooks: URL https://smahfuzm.in/quran-noor/api/pay.php,
// events order.paid and refund.processed (payment.captured is ignored), and a secret that is also saved on the server in
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
    // order.paid carries the order too. Orders made by Payment Pages have no receipt code and keep the buyer's
    // email in their notes; orders from your other sites (book store, NearQo) carry a receipt code.
    if ($event === 'order.paid' && is_array($p)) {
        $o = $ev['payload']['order']['entity'] ?? [];
        $amount = (int)($p['amount'] ?? 0); $currency = (string)($p['currency'] ?? '');
        $ok = false;
        foreach ($cfg['prices'] as $pr) if ($pr[0] === $currency && $pr[1] === $amount) $ok = true;
        $receipt = trim((string)($o['receipt'] ?? ''));
        $notes = is_array($o['notes'] ?? null) ? $o['notes'] : [];
        if (!$ok || $receipt !== '' || !isset($notes['email'])) { echo '{"ok":true,"ignored":"not a Noor page order"}'; exit; }
        if (empty($p['email']) && !empty($notes['email'])) $p['email'] = $notes['email'];
        $p['notes'] = $notes;
        record_payment(db($cfg), $p, 'captured');
        echo '{"ok":true}'; exit;
    }
    // payment.captured alone cannot tell Noor's page from other products at the same price: noted, not unlocked
    if ($event === 'payment.captured') { echo '{"ok":true,"ignored":"waiting for order.paid"}'; exit; }
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
