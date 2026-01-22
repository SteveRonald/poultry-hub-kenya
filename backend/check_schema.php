<?php
require_once __DIR__ . '/config/database.php';
global $pdo;

echo "=== CHECKING DATABASE SCHEMA ===\n\n";

// Check products table
echo "PRODUCTS TABLE:\n";
$stmt = $pdo->query("DESCRIBE products");
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "  " . $row['Field'] . " (" . $row['Type'] . ")\n";
}

echo "\nORDERS TABLE:\n";
$stmt = $pdo->query("DESCRIBE orders");
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "  " . $row['Field'] . " (" . $row['Type'] . ")\n";
}

echo "\nVENDORS TABLE:\n";
$stmt = $pdo->query("DESCRIBE vendors");
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "  " . $row['Field'] . " (" . $row['Type'] . ")\n";
}

echo "\nPAYMENT_TRANSACTIONS TABLE:\n";
$stmt = $pdo->query("DESCRIBE payment_transactions");
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "  " . $row['Field'] . " (" . $row['Type'] . ")\n";
}
?>
