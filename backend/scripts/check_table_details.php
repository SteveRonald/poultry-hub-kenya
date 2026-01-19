<?php
require_once __DIR__ . '/../config/database.php';

echo "Checking table details...\n\n";

try {
    // Check products table details
    $stmt = $pdo->query("SHOW CREATE TABLE products");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Products CREATE TABLE:\n";
    echo $result['Create Table'] . "\n\n";
    
    // Check vendors table details
    $stmt = $pdo->query("SHOW CREATE TABLE vendors");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Vendors CREATE TABLE:\n";
    echo $result['Create Table'] . "\n\n";
    
    // Check user_profiles table details
    $stmt = $pdo->query("SHOW CREATE TABLE user_profiles");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "User_profiles CREATE TABLE:\n";
    echo $result['Create Table'] . "\n\n";
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

?>


















