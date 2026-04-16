<?php
/**
 * Commission calculation utilities
 * Handles 10% platform commission and 90% vendor earnings.
 * Commission threshold is based on delivered revenue only.
 */

require_once __DIR__ . '/wallet.php';

/**
 * Get vendor delivered revenue (cumulative revenue from delivered orders only)
 */
function getVendorDeliveredRevenue($vendorId) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("SELECT vendor_delivered_revenue, lifetime_sales FROM vendors WHERE id = ?");
        $stmt->execute([$vendorId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$result) {
            return 0.00;
        }

        if (array_key_exists('vendor_delivered_revenue', $result)) {
            return floatval($result['vendor_delivered_revenue'] ?? 0);
        }

        return floatval($result['lifetime_sales'] ?? 0);
    } catch (Exception $e) {
        error_log("Error getting vendor delivered revenue: " . $e->getMessage());
        return 0.00;
    }
}

/**
 * Backward-compatible alias.
 */
function getVendorLifetimeSales($vendorId) {
    return getVendorDeliveredRevenue($vendorId);
}

/**
 * Update vendor delivered revenue. This mirrors lifetime_sales for compatibility.
 */
function updateVendorDeliveredRevenue($vendorId, $deltaAmount) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("
            UPDATE vendors 
            SET vendor_delivered_revenue = GREATEST(vendor_delivered_revenue + ?, 0),
                lifetime_sales = GREATEST(lifetime_sales + ?, 0)
            WHERE id = ?
        ");
        $stmt->execute([$deltaAmount, $deltaAmount, $vendorId]);
        return true;
    } catch (Exception $e) {
        error_log("Error updating vendor delivered revenue: " . $e->getMessage());
        return false;
    }
}

/**
 * Backward-compatible alias.
 */
function updateVendorLifetimeSales($vendorId, $orderAmount) {
    return updateVendorDeliveredRevenue($vendorId, $orderAmount);
}

/**
 * Check if vendor has exceeded commission threshold
 */
function hasExceededCommissionThreshold($vendorId, $threshold = 10000) {
    $deliveredRevenue = getVendorDeliveredRevenue($vendorId);
    return $deliveredRevenue >= $threshold;
}

/**
 * Calculate commission for an order
 * Returns commission only if vendor has exceeded KSh 10,000 threshold
 */
function calculateCommission($totalAmount, $vendorId = null, $deliveredRevenueBefore = null) {
    $commissionRate = 0.10; // 10% platform commission
    $vendorRate = 0.90;     // 90% vendor earnings
    $threshold = 10000;     // KSh 10,000 threshold
    
    // If vendor_id is provided, check threshold
    if ($vendorId !== null || $deliveredRevenueBefore !== null) {
        $revenueBefore = $deliveredRevenueBefore;
        if ($revenueBefore === null && $vendorId !== null) {
            $revenueBefore = getVendorDeliveredRevenue($vendorId);
        }
        $revenueBefore = floatval($revenueBefore ?? 0);
        
        // If vendor hasn't reached threshold, no commission
        if ($revenueBefore < $threshold) {
            return [
                'total_amount' => floatval($totalAmount),
                'commission_amount' => 0.00,
                'vendor_amount' => floatval($totalAmount), // Vendor keeps 100%
                'threshold_reached' => false,
                'delivered_revenue_before' => $revenueBefore,
                'threshold' => $threshold
            ];
        }
    }
    
    // Vendor has exceeded threshold, apply commission
    return [
        'total_amount' => floatval($totalAmount),
        'commission_amount' => round($totalAmount * $commissionRate, 2),
        'vendor_amount' => round($totalAmount * $vendorRate, 2),
        'threshold_reached' => true,
        'delivered_revenue_before' => $deliveredRevenueBefore !== null
            ? floatval($deliveredRevenueBefore)
            : ($vendorId !== null ? getVendorDeliveredRevenue($vendorId) : null),
        'threshold' => $threshold
    ];
}

/**
 * Process commission when order is delivered
 */
function processCommission($orderId, $vendorId, $totalAmount) {
    global $pdo;
    
    try {
        // Only start a new transaction if we're not already in one
        $inTransaction = $pdo->inTransaction();
        if (!$inTransaction) {
            $pdo->beginTransaction();
        }
        
        // Lock and validate order. Commission is only ever processed for delivered orders.
        $stmt = $pdo->prepare("\n            SELECT order_number, user_id, advertisement_id, status, commission_applied, commission_amount\n            FROM orders\n            WHERE id = ?\n            FOR UPDATE\n        ");
        $stmt->execute([$orderId]);
        $orderState = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$orderState) {
            if (!$inTransaction) {
                $pdo->rollBack();
            }
            return ['success' => false, 'message' => 'Order not found'];
        }

        if (($orderState['status'] ?? '') !== 'delivered') {
            if (!$inTransaction) {
                $pdo->rollBack();
            }
            return ['success' => false, 'message' => 'Commission can only be processed for delivered orders'];
        }

        // Idempotency: if earnings already exist for this order, treat as already processed.
        $stmt = $pdo->prepare("SELECT id FROM vendor_earnings WHERE order_id = ? LIMIT 1");
        $stmt->execute([$orderId]);
        if ($stmt->fetch(PDO::FETCH_ASSOC)) {
            if (!$inTransaction) {
                $pdo->commit();
            }
            return ['success' => true, 'message' => 'Commission already processed for this order'];
        }
        
        // IMPORTANT: threshold uses delivered revenue BEFORE this order is counted.
        $deliveredRevenueBefore = getVendorDeliveredRevenue($vendorId);
        
        // Calculate commission based on delivered revenue before this order.
        $commission = calculateCommission($totalAmount, $vendorId, $deliveredRevenueBefore);
        
        // Get order details including advertisement_id
        $stmt = $pdo->prepare("
            SELECT o.order_number, o.user_id, o.advertisement_id, v.farm_name, u.full_name as customer_name
            FROM orders o 
            JOIN vendors v ON o.vendor_id = v.id
            JOIN user_profiles u ON o.user_id = u.id
            WHERE o.id = ?
        ");
        $stmt->execute([$orderId]);
        $orderDetails = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Add this delivered order to vendor delivered revenue (always, regardless of commission).
        updateVendorDeliveredRevenue($vendorId, $totalAmount);
        
        // Track threshold crossing informationally.
        $deliveredRevenueAfter = getVendorDeliveredRevenue($vendorId);
        $threshold = 10000;
        
        if ($deliveredRevenueBefore < $threshold && $deliveredRevenueAfter >= $threshold) {
            error_log("Vendor {$vendorId} crossed delivered threshold with order {$orderId}. Delivered revenue: {$deliveredRevenueBefore} -> {$deliveredRevenueAfter}. Commission remains based on pre-order revenue.");
        }
        
        // If vendor hasn't reached threshold, no commission to process
        if (!$commission['threshold_reached']) {
            // Still create vendor earnings record with 100% (no commission deducted)
            // This ensures earnings show up even for vendors below threshold
            $vendorEarningId = generateUUID();
            $stmt = $pdo->prepare("
                INSERT INTO vendor_earnings 
                (id, vendor_id, order_id, total_amount, commission_amount, net_amount, status, confirmed_at)
                VALUES (?, ?, ?, ?, ?, ?, 'confirmed', NOW())
            ");
            $stmt->execute([
                $vendorEarningId,
                $vendorId,
                $orderId,
                $totalAmount,
                0.00, // No commission
                $totalAmount // Vendor gets 100%
            ]);

            // Move earning from pending to available in wallet ledger.
            releasePendingWalletEarning(
                $vendorId,
                $orderId,
                $totalAmount,
                0.00,
                'order-' . $orderId
            );

            // Persist per-order commission state.
            $stmt = $pdo->prepare("\n                UPDATE orders\n                SET commission_applied = 0, commission_amount = 0\n                WHERE id = ?\n            ");
            $stmt->execute([$orderId]);
            
            // NOTE: Ad revenue update is now handled separately AFTER the transaction commits
            // This ensures ad orders are processed exactly like normal orders
            
            // Still update lifetime sales, but don't create commission records
            if (!$inTransaction) {
                $pdo->commit();
            }
            return [
                'success' => true,
                'message' => 'Order processed. No commission applied (vendor below KSh 10,000 threshold)',
                'commission' => $commission,
                'delivered_revenue' => $deliveredRevenueAfter
            ];
        }
        
        // Generate UUIDs
        $platformCommissionId = generateUUID();
        $vendorEarningId = generateUUID();
        
        // Insert platform commission record
        $stmt = $pdo->prepare("
            INSERT INTO platform_commissions 
            (id, order_id, vendor_id, total_amount, commission_amount, vendor_amount, status, processed_at)
            VALUES (?, ?, ?, ?, ?, ?, 'processed', NOW())
        ");
        $stmt->execute([
            $platformCommissionId,
            $orderId,
            $vendorId,
            $commission['total_amount'],
            $commission['commission_amount'],
            $commission['vendor_amount']
        ]);
        
        // Insert vendor earnings record
        $stmt = $pdo->prepare("
            INSERT INTO vendor_earnings 
            (id, vendor_id, order_id, total_amount, commission_amount, net_amount, status, confirmed_at)
            VALUES (?, ?, ?, ?, ?, ?, 'confirmed', NOW())
        ");
        $stmt->execute([
            $vendorEarningId,
            $vendorId,
            $orderId,
            $commission['total_amount'],
            $commission['commission_amount'],
            $commission['vendor_amount']
        ]);

        // Persist per-order commission state.
        $stmt = $pdo->prepare("\n            UPDATE orders\n            SET commission_applied = 1, commission_amount = ?\n            WHERE id = ?\n        ");
        $stmt->execute([$commission['commission_amount'], $orderId]);

        // Move earning from pending to available and apply commission deduction in wallet ledger.
        releasePendingWalletEarning(
            $vendorId,
            $orderId,
            $commission['total_amount'],
            $commission['commission_amount'],
            'order-' . $orderId
        );
        
        // NOTE: Ad revenue update is now handled separately AFTER the transaction commits
        // This ensures ad orders are processed exactly like normal orders
        
        // Only commit if we started the transaction
        if (!$inTransaction) {
            $pdo->commit();
        }
        
        // Send notifications about commission processing
        require_once __DIR__ . '/notifications.php';
        
        if ($orderDetails) {
            // Notify vendor about earnings
            $vendorMessage = "Commission processed for order #{$orderDetails['order_number']}. You earned KSH " . number_format($commission['vendor_amount'], 2);
            notifyVendor($vendorId, $vendorMessage, 'earnings');
            
            // Notify admins about commission processing
            $adminMessage = "Commission processed for order #{$orderDetails['order_number']}. Platform earned KSH " . number_format($commission['commission_amount'], 2) . ", Vendor earned KSH " . number_format($commission['vendor_amount'], 2);
            notifyAllAdmins($adminMessage, 'commission');
        }
        
        return [
            'success' => true,
            'message' => 'Commission processed successfully',
            'commission' => $commission
        ];
        
    } catch (Exception $e) {
        if (!$inTransaction) {
            $pdo->rollBack();
        }
        error_log("Commission processing error: " . $e->getMessage());
        return ['success' => false, 'message' => 'Failed to process commission: ' . $e->getMessage()];
    }
}

/**
 * Reverse commission and delivered revenue for an order that is moved away from delivered.
 */
function reverseCommissionForOrder($orderId, $vendorId, $totalAmount) {
    global $pdo;

    $inTransaction = $pdo->inTransaction();
    if (!$inTransaction) {
        $pdo->beginTransaction();
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM vendor_earnings WHERE order_id = ?");
        $stmt->execute([$orderId]);

        $stmt = $pdo->prepare("DELETE FROM platform_commissions WHERE order_id = ?");
        $stmt->execute([$orderId]);

        updateVendorDeliveredRevenue($vendorId, -abs(floatval($totalAmount)));

        $stmt = $pdo->prepare("\n            UPDATE orders\n            SET commission_applied = 0, commission_amount = 0\n            WHERE id = ?\n        ");
        $stmt->execute([$orderId]);

        if (!$inTransaction) {
            $pdo->commit();
        }

        return ['success' => true];
    } catch (Exception $e) {
        if (!$inTransaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

/**
 * Get platform total commission (for admin dashboard)
 */
function getPlatformTotalCommission() {
    global $pdo;
    
    try {
        $stmt = $pdo->query("
            SELECT COALESCE(SUM(commission_amount), 0) as total_commission
            FROM platform_commissions 
            WHERE status = 'processed'
        ");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return floatval($result['total_commission']);
    } catch (Exception $e) {
        error_log("Error getting platform commission: " . $e->getMessage());
        return 0;
    }
}

/**
 * Get vendor total earnings
 */
function getVendorTotalEarnings($vendorId) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("
            SELECT COALESCE(SUM(net_amount), 0) as total_earnings
            FROM vendor_earnings 
            WHERE vendor_id = ? AND status = 'confirmed'
        ");
        $stmt->execute([$vendorId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return floatval($result['total_earnings']);
    } catch (Exception $e) {
        error_log("Error getting vendor earnings: " . $e->getMessage());
        return 0;
    }
}

/**
 * Get vendor earnings breakdown
 */
function getVendorEarningsBreakdown($vendorId, $limit = 10) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("
            SELECT 
                ve.*,
                o.created_at as order_date,
                p.name as product_name,
                o.quantity,
                o.total_amount as order_total
            FROM vendor_earnings ve
            JOIN orders o ON ve.order_id = o.id
            JOIN products p ON o.product_id = p.id
            WHERE ve.vendor_id = ? AND ve.status = 'confirmed'
            ORDER BY ve.created_at DESC
            LIMIT ?
        ");
        $stmt->execute([$vendorId, $limit]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        error_log("Error getting vendor earnings breakdown: " . $e->getMessage());
        return [];
    }
}

/**
 * Generate UUID
 */
function generateUUID() {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

/**
 * Check if order is eligible for commission processing
 */
function isOrderEligibleForCommission($orderId) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("
            SELECT o.status, o.total_amount, p.vendor_id
            FROM orders o
            JOIN products p ON o.product_id = p.id
            WHERE o.id = ? AND o.status = 'delivered'
        ");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        
        return $order ? [
            'eligible' => true,
            'vendor_id' => $order['vendor_id'],
            'total_amount' => $order['total_amount']
        ] : ['eligible' => false];
    } catch (Exception $e) {
        error_log("Error checking commission eligibility: " . $e->getMessage());
        return ['eligible' => false];
    }
}
?>
