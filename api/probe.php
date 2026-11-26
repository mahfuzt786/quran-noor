<?php
// Temporary: tells the developer whether this server can run the sync endpoint. Removed after setup.
header('Content-Type: application/json');
header('Cache-Control: no-store');
echo json_encode([
  'php' => PHP_VERSION,
  'pdo_sqlite' => extension_loaded('pdo_sqlite'),
  'pdo_mysql' => extension_loaded('pdo_mysql'),
  'curl' => extension_loaded('curl'),
  'openssl' => extension_loaded('openssl'),
  'url_fopen' => (bool) ini_get('allow_url_fopen'),
  'var_lib_writable' => is_writable('/var/lib/noor-sync'),
]);
