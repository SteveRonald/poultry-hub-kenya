<?php

function migrate_add_vendor_payout_accounts_table($pdo) {
    try {
        $pdo->exec("\n            CREATE TABLE IF NOT EXISTS vendor_payout_accounts (\n                id INT AUTO_INCREMENT PRIMARY KEY,\n                vendor_id CHAR(36) NOT NULL,\n                method ENUM('bank','mobile_money') NOT NULL,\n                account_name VARCHAR(150) NOT NULL,\n                provider_name VARCHAR(150) NOT NULL,\n                provider_code VARCHAR(50) DEFAULT NULL,\n                account_number_encrypted TEXT NOT NULL,\n                account_last4 VARCHAR(4) NOT NULL,\n                paystack_recipient_code VARCHAR(100) NOT NULL,\n                is_active TINYINT(1) NOT NULL DEFAULT 1,\n                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n                KEY idx_vendor_payout_accounts_vendor (vendor_id),\n                KEY idx_vendor_payout_accounts_active (vendor_id, is_active),\n                UNIQUE KEY uq_vendor_payout_accounts_recipient (paystack_recipient_code),\n                CONSTRAINT fk_vendor_payout_accounts_vendor\n                    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE\n            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci\n        ");

        echo "✓ vendor_payout_accounts table ready\n";
    } catch (PDOException $e) {
        echo "Vendor payout accounts migration failed: " . $e->getMessage() . "\n";
        exit(1);
    }
}

?>