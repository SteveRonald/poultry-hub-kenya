<?php

require_once __DIR__ . '/../config/database.php';

function migrate_add_payout_failure_retry_fields($pdo) {
    try {
        $checks = [
            'failure_reason' => "ALTER TABLE payouts ADD COLUMN failure_reason TEXT NULL AFTER paystack_transfer_reference",
            'last_error_code' => "ALTER TABLE payouts ADD COLUMN last_error_code VARCHAR(100) NULL AFTER failure_reason",
            'retry_count' => "ALTER TABLE payouts ADD COLUMN retry_count INT(11) NOT NULL DEFAULT 0 AFTER last_error_code",
            'last_retry_at' => "ALTER TABLE payouts ADD COLUMN last_retry_at TIMESTAMP NULL DEFAULT NULL AFTER retry_count"
        ];

        foreach ($checks as $column => $sql) {
            $stmt = $pdo->query("SHOW COLUMNS FROM payouts LIKE '" . $column . "'");
            if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                $pdo->exec($sql);
                echo "Added payouts.{$column} column\n";
            } else {
                echo "payouts.{$column} already exists\n";
            }
        }
    } catch (PDOException $e) {
        echo "Payout failure/retry fields migration failed: " . $e->getMessage() . "\n";
        exit(1);
    }
}

?>