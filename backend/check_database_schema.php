<?php
/**
 * Database Schema Verification Script
 * This script checks if all required tables and columns exist for cart and orders functionality
 */

require_once __DIR__ . '/config/database.php';

function checkTableExists($pdo, $tableName) {
    try {
        $stmt = $pdo->prepare("SHOW TABLES LIKE :table");
        $stmt->execute([':table' => $tableName]);
        return $stmt->rowCount() > 0;
    } catch (PDOException $e) {
        // Try alternative method
        try {
            $stmt = $pdo->query("SHOW TABLES");
            $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
            return in_array($tableName, $tables);
        } catch (PDOException $e2) {
            error_log("Error checking table $tableName: " . $e2->getMessage());
            return false;
        }
    }
}

function checkColumnExists($pdo, $tableName, $columnName) {
    try {
        $columns = getTableColumns($pdo, $tableName);
        return in_array($columnName, $columns);
    } catch (PDOException $e) {
        error_log("Error checking column $tableName.$columnName: " . $e->getMessage());
        return false;
    }
}

function getTableColumns($pdo, $tableName) {
    try {
        $stmt = $pdo->prepare("SHOW COLUMNS FROM `$tableName`");
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    } catch (PDOException $e) {
        error_log("Error getting columns for $tableName: " . $e->getMessage());
        return [];
    }
}

echo "=== Database Schema Verification ===\n\n";

// Check cart table
echo "1. Checking CART table...\n";
if (checkTableExists($pdo, 'cart')) {
    echo "   ✓ Table 'cart' exists\n";
    $requiredColumns = ['id', 'user_id', 'product_id', 'quantity', 'created_at'];
    $existingColumns = getTableColumns($pdo, 'cart');
    
    foreach ($requiredColumns as $col) {
        if (in_array($col, $existingColumns)) {
            echo "   ✓ Column '$col' exists\n";
        } else {
            echo "   ✗ Column '$col' MISSING\n";
        }
    }
} else {
    echo "   ✗ Table 'cart' DOES NOT EXIST\n";
    echo "   Required SQL:\n";
    echo "   CREATE TABLE cart (\n";
    echo "       id INT AUTO_INCREMENT PRIMARY KEY,\n";
    echo "       user_id INT NOT NULL,\n";
    echo "       product_id INT NOT NULL,\n";
    echo "       quantity INT NOT NULL DEFAULT 1,\n";
    echo "       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n";
    echo "       UNIQUE KEY unique_user_product (user_id, product_id),\n";
    echo "       FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,\n";
    echo "       FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE\n";
    echo "   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n";
}

echo "\n";

// Check orders table
echo "2. Checking ORDERS table...\n";
if (checkTableExists($pdo, 'orders')) {
    echo "   ✓ Table 'orders' exists\n";
    $requiredColumns = [
        'id', 'order_number', 'user_id', 'product_id', 'quantity', 'vendor_id',
        'total_amount', 'shipping_address', 'contact_phone', 'payment_method',
        'notes', 'order_type', 'advertisement_id', 'status', 'created_at'
    ];
    $existingColumns = getTableColumns($pdo, 'orders');
    
    foreach ($requiredColumns as $col) {
        if (in_array($col, $existingColumns)) {
            echo "   ✓ Column '$col' exists\n";
        } else {
            echo "   ✗ Column '$col' MISSING\n";
        }
    }
} else {
    echo "   ✗ Table 'orders' DOES NOT EXIST\n";
    echo "   Required SQL:\n";
    echo "   CREATE TABLE orders (\n";
    echo "       id INT AUTO_INCREMENT PRIMARY KEY,\n";
    echo "       order_number VARCHAR(50) UNIQUE NOT NULL,\n";
    echo "       user_id INT NOT NULL,\n";
    echo "       product_id INT NOT NULL,\n";
    echo "       quantity INT NOT NULL,\n";
    echo "       vendor_id INT NOT NULL,\n";
    echo "       total_amount DECIMAL(10,2) NOT NULL,\n";
    echo "       shipping_address TEXT NOT NULL,\n";
    echo "       contact_phone VARCHAR(20) NOT NULL,\n";
    echo "       payment_method VARCHAR(50) NOT NULL,\n";
    echo "       notes TEXT,\n";
    echo "       order_type VARCHAR(20) DEFAULT 'cart',\n";
    echo "       advertisement_id VARCHAR(50) NULL,\n";
    echo "       status VARCHAR(20) DEFAULT 'pending',\n";
    echo "       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n";
    echo "       FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,\n";
    echo "       FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,\n";
    echo "       FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE\n";
    echo "   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n";
}

echo "\n";

// Check products table (for image_urls column)
echo "3. Checking PRODUCTS table (for cart functionality)...\n";
if (checkTableExists($pdo, 'products')) {
    echo "   ✓ Table 'products' exists\n";
    $requiredColumns = ['id', 'name', 'price', 'stock_quantity', 'unit', 'image_urls', 'category', 'vendor_id', 'is_active'];
    $existingColumns = getTableColumns($pdo, 'products');
    
    foreach ($requiredColumns as $col) {
        if (in_array($col, $existingColumns)) {
            echo "   ✓ Column '$col' exists\n";
        } else {
            echo "   ✗ Column '$col' MISSING\n";
        }
    }
} else {
    echo "   ✗ Table 'products' DOES NOT EXIST\n";
}

echo "\n=== Verification Complete ===\n";

