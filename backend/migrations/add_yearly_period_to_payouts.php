<?php

function migrate_add_yearly_period_to_payouts($pdo) {
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM payouts LIKE 'period_type'");
        $column = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$column) {
            echo "! payouts.period_type not found, skipping yearly enum migration\n";
            return;
        }

        $typeDef = strtolower($column['Type'] ?? '');
        if (strpos($typeDef, "'yearly'") !== false) {
            echo "✓ payouts.period_type already supports yearly\n";
            return;
        }

        $pdo->exec("\n            ALTER TABLE payouts\n            MODIFY COLUMN period_type ENUM('daily','weekly','monthly','yearly','manual') NOT NULL DEFAULT 'manual'\n        ");

        echo "✓ Added yearly to payouts.period_type enum\n";
    } catch (PDOException $e) {
        echo "Yearly payouts enum migration failed: " . $e->getMessage() . "\n";
        exit(1);
    }
}

?>