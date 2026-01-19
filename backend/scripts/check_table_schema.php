<?php
/**
 * Check actual column types in existing tables
 */

require_once __DIR__ . '/../config/database.php';

echo "Checking table schemas...\n\n";

try {
    // Check products table
    $stmt = $pdo->query("DESCRIBE products");
    $productsColumns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Products table:\n";
    foreach ($productsColumns as $col) {
        if ($col['Field'] === 'id') {
            echo "  id: " . $col['Type'] . "\n";
        }
        if ($col['Field'] === 'vendor_id') {
            echo "  vendor_id: " . $col['Type'] . "\n";
        }
    }
    echo "\n";
    
    // Check vendors table
    $stmt = $pdo->query("DESCRIBE vendors");
    $vendorsColumns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Vendors table:\n";
    foreach ($vendorsColumns as $col) {
        if ($col['Field'] === 'id') {
            echo "  id: " . $col['Type'] . "\n";
        }
        if ($col['Field'] === 'user_id') {
            echo "  user_id: " . $col['Type'] . "\n";
        }
    }
    echo "\n";
    
    // Check user_profiles table
    $stmt = $pdo->query("DESCRIBE user_profiles");
    $userProfilesColumns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "User_profiles table:\n";
    foreach ($userProfilesColumns as $col) {
        if ($col['Field'] === 'id') {
            echo "  id: " . $col['Type'] . "\n";
        }
    }
    echo "\n";
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

?>


















