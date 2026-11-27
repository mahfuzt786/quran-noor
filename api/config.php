<?php
// Settings for the progress-sync endpoint. Server-specific overrides go in config.local.php (not in git).
// This file prints nothing if opened in a browser, and api/.htaccess blocks it anyway.

return array_merge([
    // Google OAuth web client (public by design — it is also in the page).
    'google_client_id' => '229303568022-f1ac5svku961mpbs7ovioliavfrfvn71.apps.googleusercontent.com',
    // SQLite file. Must be outside the web folder and writable by the web server user.
    'db_path' => getenv('NOOR_SYNC_DB') ?: '/var/lib/noor-sync/noor.sqlite',
    // Pages allowed to call the endpoint.
    'origins' => ['https://smahfuzm.in', 'http://localhost', 'http://localhost:4195'],
    'session_days' => 180,
    // Full access: Razorpay webhook secret (one line, saved on the server, never in git) and the accepted prices
    'rzp_webhook_secret_file' => getenv('NOOR_RZP_SECRET_FILE') ?: '/var/lib/noor-sync/razorpay-webhook-secret',
    'prices' => [['INR', 4900], ['USD', 299]],
    // Google accounts that may open the admin page (give free full access, see payments)
    'admin_emails' => ['mahfuzz786@gmail.com'],
    'max_bytes' => 2 * 1024 * 1024,
], is_file(__DIR__ . '/config.local.php') ? (require __DIR__ . '/config.local.php') : []);
