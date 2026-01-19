<?php
require_once __DIR__ . '/../config/database.php';

try {
    // Create payment_transactions table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `payment_transactions` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `transaction_reference` varchar(100) NOT NULL UNIQUE,
            `order_id` int(11) NOT NULL,
            `user_id` int(11) NOT NULL,
            `amount` decimal(10,2) NOT NULL,
            `currency` varchar(3) NOT NULL DEFAULT 'KES',
            `payment_method` varchar(50) NOT NULL DEFAULT 'paystack',
            `payment_status` enum('pending','success','failed','cancelled') NOT NULL DEFAULT 'pending',
            `paystack_transaction_id` varchar(50) NULL,
            `paystack_access_code` varchar(100) NULL,
            `paystack_paid_at` datetime NULL,
            `gateway_response` longtext NULL,
            `metadata` longtext NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

            PRIMARY KEY (`id`),
            UNIQUE KEY `unique_transaction_reference` (`transaction_reference`),
            KEY `idx_order_id` (`order_id`),
            KEY `idx_user_id` (`user_id`),
            KEY `idx_payment_status` (`payment_status`),
            KEY `idx_created_at` (`created_at`),

            /* Foreign key constraints removed for compatibility */
            /* CONSTRAINT `fk_payment_transactions_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE, */
            /* CONSTRAINT `fk_payment_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `user_profiles` (`id`) ON DELETE CASCADE */
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // Create payment_webhooks table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `payment_webhooks` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `paystack_event_id` varchar(100) NULL,
            `event_type` varchar(100) NOT NULL,
            `transaction_reference` varchar(100) NULL,
            `webhook_data` longtext NOT NULL,
            `processed_at` timestamp NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,

            PRIMARY KEY (`id`),
            KEY `idx_event_type` (`event_type`),
            KEY `idx_transaction_reference` (`transaction_reference`),
            KEY `idx_processed_at` (`processed_at`),
            KEY `idx_created_at` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // Add payment-related columns to orders table if they don't exist
    $columns = $pdo->query("DESCRIBE orders")->fetchAll(PDO::FETCH_COLUMN, 0);

    if (!in_array('payment_status', $columns)) {
        $pdo->exec("ALTER TABLE `orders` ADD COLUMN `payment_status` enum('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending' AFTER `status`");
    }

    if (!in_array('payment_transaction_id', $columns)) {
        $pdo->exec("ALTER TABLE `orders` ADD COLUMN `payment_transaction_id` varchar(50) NULL AFTER `payment_status`");
    }

    if (!in_array('payment_reference', $columns)) {
        $pdo->exec("ALTER TABLE `orders` ADD COLUMN `payment_reference` varchar(100) NULL AFTER `payment_transaction_id`");
    }

    if (!in_array('payment_completed_at', $columns)) {
        $pdo->exec("ALTER TABLE `orders` ADD COLUMN `payment_completed_at` timestamp NULL AFTER `payment_reference`");
    }

    // Create indexes for better performance
    $pdo->exec("CREATE INDEX IF NOT EXISTS `idx_orders_payment_status` ON `orders` (`payment_status`)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS `idx_orders_payment_reference` ON `orders` (`payment_reference`)");

    echo "Paystack payment tables migration completed successfully!\n";

} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
?>
