<?php

function migrate_add_delivered_revenue_and_commission_fields($pdo) {
    try {
        // 1) Add vendor_delivered_revenue if missing
        $stmt = $pdo->query("SHOW COLUMNS FROM vendors LIKE 'vendor_delivered_revenue'");
        if ($stmt->rowCount() === 0) {
            $pdo->exec("\n                ALTER TABLE vendors\n                ADD COLUMN vendor_delivered_revenue DECIMAL(10,2) DEFAULT 0.00\n                COMMENT 'Cumulative delivered order revenue only'\n            ");
            echo "✓ Added vendors.vendor_delivered_revenue\n";
        } else {
            echo "✓ vendors.vendor_delivered_revenue already exists\n";
        }

        // 2) Add commission tracking fields on orders if missing
        $stmt = $pdo->query("SHOW COLUMNS FROM orders LIKE 'commission_applied'");
        if ($stmt->rowCount() === 0) {
            $pdo->exec("\n                ALTER TABLE orders\n                ADD COLUMN commission_applied TINYINT(1) NOT NULL DEFAULT 0\n            ");
            echo "✓ Added orders.commission_applied\n";
        } else {
            echo "✓ orders.commission_applied already exists\n";
        }

        $stmt = $pdo->query("SHOW COLUMNS FROM orders LIKE 'commission_amount'");
        if ($stmt->rowCount() === 0) {
            $pdo->exec("\n                ALTER TABLE orders\n                ADD COLUMN commission_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00\n            ");
            echo "✓ Added orders.commission_amount\n";
        } else {
            echo "✓ orders.commission_amount already exists\n";
        }

        // 3) Backfill vendor_delivered_revenue from delivered orders only
        $pdo->exec("\n            UPDATE vendors v\n            LEFT JOIN (\n                SELECT vendor_id, COALESCE(SUM(total_amount), 0) AS delivered_total\n                FROM orders\n                WHERE status = 'delivered'\n                GROUP BY vendor_id\n            ) d ON d.vendor_id = v.id\n            SET v.vendor_delivered_revenue = COALESCE(d.delivered_total, 0),\n                v.lifetime_sales = COALESCE(d.delivered_total, 0)\n        ");
        echo "✓ Backfilled vendors.vendor_delivered_revenue from delivered orders\n";

        // 4) Backfill order commission flags from existing vendor_earnings records
        $pdo->exec("\n            UPDATE orders o\n            LEFT JOIN vendor_earnings ve ON ve.order_id = o.id\n            SET o.commission_amount = COALESCE(ve.commission_amount, 0),\n                o.commission_applied = CASE WHEN COALESCE(ve.commission_amount, 0) > 0 THEN 1 ELSE 0 END\n        ");
        echo "✓ Backfilled orders commission fields from vendor_earnings\n";

        // 5) Ensure non-delivered orders are never marked as commission-applied
        $pdo->exec("\n            UPDATE orders\n            SET commission_applied = 0, commission_amount = 0\n            WHERE status <> 'delivered'\n        ");
        echo "✓ Normalized commission fields for non-delivered orders\n";

        echo "Delivered revenue and commission tracking migration completed successfully!\n";
    } catch (PDOException $e) {
        echo "Delivered revenue migration failed: " . $e->getMessage() . "\n";
        exit(1);
    }
}

?>