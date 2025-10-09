<?php
/**
 * Commission calculation utilities
 * Handles 10% platform commission and 90% vendor earnings
 */

/**
 * Calculate commission for an order
 */
function calculateCommission($totalAmount) {
    $commissionRate = 0.10; // 10% platform commission
    $vendorRate = 0.90;     // 90% vendor earnings
    
    return [
        'total_amount' => floatval($totalAmount),
        'commission_amount' => round($totalAmount * $commissionRate, 2),
        'vendor_amount' => round($totalAmount * $vendorRate, 2)
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
        
        // Check if commission already exists for this order
        $stmt = $pdo->prepare("SELECT id FROM platform_commissions WHERE order_id = ?");
        $stmt->execute([$orderId]);
        if ($stmt->fetch()) {
            if (!$inTransaction) {
                $pdo->rollBack();
            }
            return ['success' => false, 'message' => 'Commission already processed for this order'];
        }
        
        // Calculate commission amounts
        $commission = calculateCommission($totalAmount);
        
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
        
        // Only commit if we started the transaction
        if (!$inTransaction) {
            $pdo->commit();
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
