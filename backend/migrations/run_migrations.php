<?php
/**
 * Migration Runner
 * Run database migrations safely
 */

require_once __DIR__ . '/../config/database.php';

try {
    echo "=== RUNNING DATABASE MIGRATIONS ===\n\n";
    
    // Migration 1: Add minimum_order_quantity to products
    echo "Migration 1: Adding minimum_order_quantity to products table...\n";
    
    // Check if column already exists
    $stmt = $pdo->query("SHOW COLUMNS FROM products LIKE 'minimum_order_quantity'");
    if ($stmt->rowCount() == 0) {
        $pdo->exec("
            ALTER TABLE products 
            ADD COLUMN minimum_order_quantity INT DEFAULT 1 NOT NULL
        ");
        echo "✓ minimum_order_quantity column added\n";
    } else {
        echo "✓ minimum_order_quantity column already exists\n";
    }
    
    $pdo->exec("
        UPDATE products 
        SET minimum_order_quantity = 1 
        WHERE minimum_order_quantity IS NULL OR minimum_order_quantity < 1
    ");
    
    echo "✓ Default values set successfully\n\n";
    
    // Migration 2: Create system_settings table
    echo "Migration 2: Creating system_settings table...\n";
    
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS system_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setting_key VARCHAR(100) UNIQUE NOT NULL,
            setting_value TEXT NOT NULL,
            setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
            description TEXT,
            updated_by INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_setting_key (setting_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    
    echo "✓ system_settings table created successfully\n\n";
    
    // Insert default settings
    echo "Migration 3: Inserting default system settings...\n";
    
    $stmt = $pdo->prepare("
        INSERT INTO system_settings (setting_key, setting_value, setting_type, description) 
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    ");
    
    $settings = [
        ['delivery_fee', '100', 'number', 'Default delivery fee charged on all orders (in KSH)'],
        ['platform_commission_rate', '10', 'number', 'Platform commission percentage on vendor sales'],
        ['min_withdrawal_amount', '500', 'number', 'Minimum amount vendors can withdraw (in KSH)'],
        ['free_delivery_threshold', '5000', 'number', 'Order amount above which delivery is free (in KSH, 0 to disable)']
    ];
    
    foreach ($settings as $setting) {
        $stmt->execute($setting);
        echo "  - {$setting[0]}: {$setting[1]}\n";
    }
    
    echo "\n✓ Default settings inserted successfully\n\n";

    // Migration 4: Create wallet, ledger and payout tables
    echo "Migration 4: Creating wallet, ledger and payout tables...\n";
    require_once __DIR__ . '/add_wallet_tables.php';
    migrate_add_wallet_tables($pdo);
    echo "\n✓ Wallet and payout tables migration complete\n\n";

    // Migration 5: Create warehouses and pickup_locations tables
    echo "Migration 5: Creating warehouses and pickup_locations tables...\n";
    require_once __DIR__ . '/add_warehouse_pickup_locations_tables.php';
    migrate_add_warehouse_pickup_locations_tables($pdo);
    echo "\n✓ Warehouses and pickup locations migration complete\n\n";

    // Migration 6: Add delivered revenue and order commission tracking fields
    echo "Migration 6: Adding delivered revenue and order commission tracking...\n";
    require_once __DIR__ . '/add_delivered_revenue_and_commission_fields.php';
    migrate_add_delivered_revenue_and_commission_fields($pdo);
    echo "\n✓ Delivered revenue and order commission tracking migration complete\n\n";

    // Migration 7: Ensure payouts period_type supports yearly
    echo "Migration 7: Ensuring payouts period_type supports yearly...\n";
    require_once __DIR__ . '/add_yearly_period_to_payouts.php';
    migrate_add_yearly_period_to_payouts($pdo);
    echo "\n✓ Payouts yearly period migration complete\n\n";

    // Migration 8: Create vendor payout accounts table
    echo "Migration 8: Creating vendor payout accounts table...\n";
    require_once __DIR__ . '/add_vendor_payout_accounts_table.php';
    migrate_add_vendor_payout_accounts_table($pdo);
    echo "\n✓ Vendor payout accounts migration complete\n\n";

    // Migration 9: Add payout failure reason and retry tracking fields
    echo "Migration 9: Adding payout failure and retry tracking fields...\n";
    require_once __DIR__ . '/add_payout_failure_retry_fields.php';
    migrate_add_payout_failure_retry_fields($pdo);
    echo "\n✓ Payout failure/retry fields migration complete\n\n";
    
    echo "=== ALL MIGRATIONS COMPLETED SUCCESSFULLY ===\n";
    
} catch (PDOException $e) {
    echo "❌ Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
