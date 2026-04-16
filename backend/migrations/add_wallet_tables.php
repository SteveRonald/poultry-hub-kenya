<?php

require_once __DIR__ . '/../config/database.php';

function migrate_add_wallet_tables($pdo) {
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `vendor_wallet` (
                `id` int(11) NOT NULL AUTO_INCREMENT,
                `vendor_id` char(36) NOT NULL,
                `available_balance` decimal(12,2) NOT NULL DEFAULT 0.00,
                `pending_balance` decimal(12,2) NOT NULL DEFAULT 0.00,
                `total_earned` decimal(12,2) NOT NULL DEFAULT 0.00,
                `total_withdrawn` decimal(12,2) NOT NULL DEFAULT 0.00,
                `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `unique_vendor_wallet_vendor_id` (`vendor_id`),
                KEY `idx_vendor_wallet_available_balance` (`available_balance`),
                KEY `idx_vendor_wallet_pending_balance` (`pending_balance`),
                KEY `idx_vendor_wallet_updated_at` (`updated_at`),
                CONSTRAINT `vendor_wallet_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `wallet_transactions` (
                `id` int(11) NOT NULL AUTO_INCREMENT,
                `vendor_id` char(36) NOT NULL,
                `order_id` int(11) DEFAULT NULL,
                `type` enum('earning','commission','payout') NOT NULL,
                `amount` decimal(12,2) NOT NULL,
                `balance_before` decimal(12,2) NOT NULL DEFAULT 0.00,
                `balance_after` decimal(12,2) NOT NULL DEFAULT 0.00,
                `status` enum('pending','available','paid') NOT NULL DEFAULT 'pending',
                `reference` varchar(100) DEFAULT NULL,
                `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_wallet_transaction_reference` (`reference`),
                UNIQUE KEY `unique_wallet_transaction_order_type` (`vendor_id`, `order_id`, `type`),
                KEY `idx_wallet_transactions_vendor_id` (`vendor_id`),
                KEY `idx_wallet_transactions_order_id` (`order_id`),
                KEY `idx_wallet_transactions_type` (`type`),
                KEY `idx_wallet_transactions_status` (`status`),
                KEY `idx_wallet_transactions_created_at` (`created_at`),
                CONSTRAINT `wallet_transactions_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE,
                CONSTRAINT `wallet_transactions_ibfk_2` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `payouts` (
                `id` int(11) NOT NULL AUTO_INCREMENT,
                `vendor_id` char(36) NOT NULL,
                `amount` decimal(12,2) NOT NULL,
                `period_type` enum('daily','weekly','monthly','manual') NOT NULL DEFAULT 'manual',
                `start_date` date NOT NULL,
                `end_date` date NOT NULL,
                `status` enum('pending','approved','paid','failed') NOT NULL DEFAULT 'pending',
                `paystack_transfer_reference` varchar(100) DEFAULT NULL,
                    `failure_reason` text DEFAULT NULL,
                    `last_error_code` varchar(100) DEFAULT NULL,
                    `retry_count` int(11) NOT NULL DEFAULT 0,
                    `last_retry_at` timestamp NULL DEFAULT NULL,
                `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `unique_payout_transfer_reference` (`paystack_transfer_reference`),
                KEY `idx_payouts_vendor_id` (`vendor_id`),
                KEY `idx_payouts_status` (`status`),
                KEY `idx_payouts_period` (`period_type`, `start_date`, `end_date`),
                KEY `idx_payouts_created_at` (`created_at`),
                CONSTRAINT `payouts_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS `vendor_transfer_recipients` (
                `id` int(11) NOT NULL AUTO_INCREMENT,
                `vendor_id` char(36) NOT NULL,
                `paystack_recipient_code` varchar(100) NOT NULL,
                `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `unique_vendor_transfer_recipient_vendor_id` (`vendor_id`),
                UNIQUE KEY `unique_vendor_transfer_recipient_code` (`paystack_recipient_code`),
                CONSTRAINT `vendor_transfer_recipients_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        ");

        echo "Wallet tables migration completed successfully!\n";
    } catch (PDOException $e) {
        echo "Wallet migration failed: " . $e->getMessage() . "\n";
        exit(1);
    }
}

?>