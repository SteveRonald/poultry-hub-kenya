<?php

require_once __DIR__ . '/../config/database.php';

$threshold = 10000.00;
$commissionRate = 0.10;

function roundMoney($value) {
    return round((float)$value, 2);
}

try {
    $pdo->beginTransaction();

    $summary = [
        'vendors_processed' => 0,
        'delivered_orders_processed' => 0,
        'orders_commission_removed' => 0,
        'orders_commission_added' => 0,
        'orders_commission_updated' => 0,
        'platform_commission_rows_deleted' => 0,
        'platform_commission_rows_upserted' => 0,
        'vendor_earnings_rows_upserted' => 0,
        'vendor_earnings_rows_deleted' => 0,
        'wallet_commission_rows_deleted' => 0,
        'wallet_commission_rows_upserted' => 0,
        'wallet_rows_resynced' => 0
    ];

    // Clean non-delivered orders first.
    $nonDeliveredStmt = $pdo->query("SELECT id FROM orders WHERE status <> 'delivered'");
    $nonDeliveredOrderIds = $nonDeliveredStmt->fetchAll(PDO::FETCH_COLUMN);

    if (!empty($nonDeliveredOrderIds)) {
        $placeholders = implode(',', array_fill(0, count($nonDeliveredOrderIds), '?'));

        $stmt = $pdo->prepare("DELETE FROM platform_commissions WHERE order_id IN ($placeholders)");
        $stmt->execute($nonDeliveredOrderIds);
        $summary['platform_commission_rows_deleted'] += $stmt->rowCount();

        $stmt = $pdo->prepare("DELETE FROM vendor_earnings WHERE order_id IN ($placeholders)");
        $stmt->execute($nonDeliveredOrderIds);
        $summary['vendor_earnings_rows_deleted'] += $stmt->rowCount();

        $stmt = $pdo->prepare("\n            DELETE FROM wallet_transactions\n            WHERE order_id IN ($placeholders) AND type = 'commission'\n        ");
        $stmt->execute($nonDeliveredOrderIds);
        $summary['wallet_commission_rows_deleted'] += $stmt->rowCount();

        $stmt = $pdo->prepare("\n            UPDATE orders\n            SET commission_applied = 0, commission_amount = 0\n            WHERE id IN ($placeholders)\n        ");
        $stmt->execute($nonDeliveredOrderIds);
    }

    // Recalculate delivered orders by vendor in chronological order.
    $vendorStmt = $pdo->query("SELECT id FROM vendors ORDER BY id");
    $vendorIds = $vendorStmt->fetchAll(PDO::FETCH_COLUMN);

    foreach ($vendorIds as $vendorId) {
        $summary['vendors_processed']++;

        $deliveredStmt = $pdo->prepare("\n            SELECT id, total_amount, COALESCE(last_status_updated, created_at) AS delivered_at\n            FROM orders\n            WHERE vendor_id = ? AND status = 'delivered'\n            ORDER BY delivered_at ASC, id ASC\n        ");
        $deliveredStmt->execute([$vendorId]);
        $orders = $deliveredStmt->fetchAll(PDO::FETCH_ASSOC);

        $runningDeliveredRevenue = 0.00;

        foreach ($orders as $order) {
            $summary['delivered_orders_processed']++;

            $orderId = (int)$order['id'];
            $orderAmount = roundMoney($order['total_amount']);

            $commissionShouldApply = $runningDeliveredRevenue >= $threshold;
            $expectedCommission = $commissionShouldApply ? roundMoney($orderAmount * $commissionRate) : 0.00;
            $expectedNet = roundMoney($orderAmount - $expectedCommission);

            // Current commission state on order.
            $currentOrderStmt = $pdo->prepare("SELECT commission_applied, commission_amount FROM orders WHERE id = ? FOR UPDATE");
            $currentOrderStmt->execute([$orderId]);
            $currentOrder = $currentOrderStmt->fetch(PDO::FETCH_ASSOC) ?: ['commission_applied' => 0, 'commission_amount' => 0];

            $currentApplied = (int)($currentOrder['commission_applied'] ?? 0) === 1;
            $currentAmount = roundMoney($currentOrder['commission_amount'] ?? 0);

            if ($currentApplied && $expectedCommission == 0.00) {
                $summary['orders_commission_removed']++;
            } elseif (!$currentApplied && $expectedCommission > 0.00) {
                $summary['orders_commission_added']++;
            } elseif ($currentAmount !== $expectedCommission) {
                $summary['orders_commission_updated']++;
            }

            // Update order commission fields.
            $orderUpdate = $pdo->prepare("\n                UPDATE orders\n                SET commission_applied = ?, commission_amount = ?\n                WHERE id = ?\n            ");
            $orderUpdate->execute([$expectedCommission > 0 ? 1 : 0, $expectedCommission, $orderId]);

            // Upsert vendor_earnings row for delivered order.
            $veCheck = $pdo->prepare("SELECT id FROM vendor_earnings WHERE order_id = ? LIMIT 1");
            $veCheck->execute([$orderId]);
            $ve = $veCheck->fetch(PDO::FETCH_ASSOC);

            if ($ve) {
                $veUpdate = $pdo->prepare("\n                    UPDATE vendor_earnings\n                    SET vendor_id = ?, total_amount = ?, commission_amount = ?, net_amount = ?, status = 'confirmed', confirmed_at = COALESCE(confirmed_at, NOW())\n                    WHERE id = ?\n                ");
                $veUpdate->execute([$vendorId, $orderAmount, $expectedCommission, $expectedNet, $ve['id']]);
            } else {
                $veInsert = $pdo->prepare("\n                    INSERT INTO vendor_earnings (id, vendor_id, order_id, total_amount, commission_amount, net_amount, status, confirmed_at)\n                    VALUES (UUID(), ?, ?, ?, ?, ?, 'confirmed', NOW())\n                ");
                $veInsert->execute([$vendorId, $orderId, $orderAmount, $expectedCommission, $expectedNet]);
            }
            $summary['vendor_earnings_rows_upserted']++;

            // Platform commission rows: keep only when commission applies.
            if ($expectedCommission > 0) {
                $pcCheck = $pdo->prepare("SELECT id FROM platform_commissions WHERE order_id = ? LIMIT 1");
                $pcCheck->execute([$orderId]);
                $pc = $pcCheck->fetch(PDO::FETCH_ASSOC);

                if ($pc) {
                    $pcUpdate = $pdo->prepare("\n                        UPDATE platform_commissions\n                        SET vendor_id = ?, total_amount = ?, commission_amount = ?, vendor_amount = ?, status = 'processed'\n                        WHERE id = ?\n                    ");
                    $pcUpdate->execute([$vendorId, $orderAmount, $expectedCommission, $expectedNet, $pc['id']]);
                } else {
                    $pcInsert = $pdo->prepare("\n                        INSERT INTO platform_commissions (id, order_id, vendor_id, total_amount, commission_amount, vendor_amount, status, processed_at)\n                        VALUES (UUID(), ?, ?, ?, ?, ?, 'processed', NOW())\n                    ");
                    $pcInsert->execute([$orderId, $vendorId, $orderAmount, $expectedCommission, $expectedNet]);
                }
                $summary['platform_commission_rows_upserted']++;
            } else {
                $pcDelete = $pdo->prepare("DELETE FROM platform_commissions WHERE order_id = ?");
                $pcDelete->execute([$orderId]);
                $summary['platform_commission_rows_deleted'] += $pcDelete->rowCount();
            }

            // Wallet commission ledger rows to reflect corrected rule.
            if ($expectedCommission > 0) {
                $wtCheck = $pdo->prepare("\n                    SELECT id FROM wallet_transactions\n                    WHERE vendor_id = ? AND order_id = ? AND type = 'commission'\n                    LIMIT 1\n                ");
                $wtCheck->execute([$vendorId, $orderId]);
                $wt = $wtCheck->fetch(PDO::FETCH_ASSOC);

                if ($wt) {
                    $wtUpdate = $pdo->prepare("\n                        UPDATE wallet_transactions\n                        SET amount = ?, status = 'paid', updated_at = NOW()\n                        WHERE id = ?\n                    ");
                    $wtUpdate->execute([$expectedCommission, $wt['id']]);
                } else {
                    $wtInsert = $pdo->prepare("\n                        INSERT INTO wallet_transactions\n                            (vendor_id, order_id, type, amount, balance_before, balance_after, status, reference)\n                        VALUES (?, ?, 'commission', ?, 0, 0, 'paid', ?)\n                    ");
                    $wtInsert->execute([$vendorId, $orderId, $expectedCommission, 'order-' . $orderId . '-commission-backfill']);
                }
                $summary['wallet_commission_rows_upserted']++;
            } else {
                $wtDelete = $pdo->prepare("\n                    DELETE FROM wallet_transactions\n                    WHERE vendor_id = ? AND order_id = ? AND type = 'commission'\n                ");
                $wtDelete->execute([$vendorId, $orderId]);
                $summary['wallet_commission_rows_deleted'] += $wtDelete->rowCount();
            }

            $runningDeliveredRevenue = roundMoney($runningDeliveredRevenue + $orderAmount);
        }
    }

    // Sync delivered revenue to vendors from delivered orders only.
    $pdo->exec("\n        UPDATE vendors v\n        LEFT JOIN (\n            SELECT vendor_id, COALESCE(SUM(total_amount), 0) AS delivered_total\n            FROM orders\n            WHERE status = 'delivered'\n            GROUP BY vendor_id\n        ) d ON d.vendor_id = v.id\n        SET v.vendor_delivered_revenue = COALESCE(d.delivered_total, 0),\n            v.lifetime_sales = COALESCE(d.delivered_total, 0)\n    ");

    // Resync vendor_wallet values from wallet ledger aggregates.
    $walletVendorStmt = $pdo->query("SELECT DISTINCT vendor_id FROM wallet_transactions");
    $walletVendors = $walletVendorStmt->fetchAll(PDO::FETCH_COLUMN);

    foreach ($walletVendors as $vendorId) {
        $ensureStmt = $pdo->prepare("\n            INSERT INTO vendor_wallet (vendor_id, available_balance, pending_balance, total_earned, total_withdrawn)\n            VALUES (?, 0, 0, 0, 0)\n            ON DUPLICATE KEY UPDATE vendor_id = vendor_id\n        ");
        $ensureStmt->execute([$vendorId]);

        $aggStmt = $pdo->prepare("\n            SELECT\n                COALESCE(SUM(CASE WHEN type = 'earning' THEN amount ELSE 0 END), 0) AS total_earned,\n                COALESCE(SUM(CASE WHEN type = 'earning' AND status = 'pending' THEN amount ELSE 0 END), 0) AS pending_earnings,\n                COALESCE(SUM(CASE WHEN type = 'earning' AND status = 'available' THEN amount ELSE 0 END), 0) AS available_earnings,\n                COALESCE(SUM(CASE WHEN type = 'commission' AND status = 'paid' THEN amount ELSE 0 END), 0) AS paid_commission,\n                COALESCE(SUM(CASE WHEN type = 'payout' AND status = 'paid' THEN amount ELSE 0 END), 0) AS paid_payouts\n            FROM wallet_transactions\n            WHERE vendor_id = ?\n        ");
        $aggStmt->execute([$vendorId]);
        $agg = $aggStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $totalEarned = roundMoney($agg['total_earned'] ?? 0);
        $pendingBalance = roundMoney($agg['pending_earnings'] ?? 0);
        $availableEarnings = roundMoney($agg['available_earnings'] ?? 0);
        $paidCommission = roundMoney($agg['paid_commission'] ?? 0);
        $paidPayouts = roundMoney($agg['paid_payouts'] ?? 0);
        $availableBalance = roundMoney(max($availableEarnings - $paidCommission - $paidPayouts, 0));

        $walletUpdate = $pdo->prepare("\n            UPDATE vendor_wallet\n            SET available_balance = ?,\n                pending_balance = ?,\n                total_earned = ?,\n                total_withdrawn = ?,\n                updated_at = NOW()\n            WHERE vendor_id = ?\n        ");
        $walletUpdate->execute([$availableBalance, $pendingBalance, $totalEarned, $paidPayouts, $vendorId]);

        $summary['wallet_rows_resynced']++;
    }

    $pdo->commit();

    // Output summary
    echo "Backfill complete using delivered-revenue threshold rules." . PHP_EOL;
    foreach ($summary as $key => $value) {
        echo $key . '=' . $value . PHP_EOL;
    }

    // Output before/after sanity totals used by commission sidebar
    $stmt = $pdo->query("SELECT COALESCE(SUM(net_amount),0) AS vendor_earnings_total FROM vendor_earnings WHERE status='confirmed'");
    $vendorEarningsTotal = roundMoney(($stmt->fetch(PDO::FETCH_ASSOC)['vendor_earnings_total'] ?? 0));

    $stmt = $pdo->query("SELECT COALESCE(SUM(commission_amount),0) AS platform_commission_total FROM platform_commissions WHERE status='processed'");
    $platformCommissionTotal = roundMoney(($stmt->fetch(PDO::FETCH_ASSOC)['platform_commission_total'] ?? 0));

    echo 'vendor_earnings_total=' . $vendorEarningsTotal . PHP_EOL;
    echo 'platform_commission_total=' . $platformCommissionTotal . PHP_EOL;

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo 'Backfill failed: ' . $e->getMessage() . PHP_EOL;
    exit(1);
}
