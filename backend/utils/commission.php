<?php
/**
 * Commission calculation utilities
 * Handles 10% platform commission and 90% vendor earnings
 */

/**
 * Get vendor lifetime sales (cumulative sales from all delivered orders)
 */
function getVendorLifetimeSales($vendorId) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("SELECT lifetime_sales FROM vendors WHERE id = ?");
        $stmt->execute([$vendorId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ? floatval($result['lifetime_sales']) : 0.00;
    } catch (Exception $e) {
        error_log("Error getting vendor lifetime sales: " . $e->getMessage());
        return 0.00;
    }
}

/**
 * Update vendor lifetime sales
 */
function updateVendorLifetimeSales($vendorId, $orderAmount) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("
            UPDATE vendors 
            SET lifetime_sales = lifetime_sales + ? 
            WHERE id = ?
        ");
        $stmt->execute([$orderAmount, $vendorId]);
        return true;
    } catch (Exception $e) {
        error_log("Error updating vendor lifetime sales: " . $e->getMessage());
        return false;
    }
}

/**
 * Check if vendor has exceeded commission threshold
 */
function hasExceededCommissionThreshold($vendorId, $threshold = 10000) {
    $lifetimeSales = getVendorLifetimeSales($vendorId);
    return $lifetimeSales >= $threshold;
}

/**
 * Calculate commission for an order
 * Returns commission only if vendor has exceeded KSh 10,000 threshold
 */
function calculateCommission($totalAmount, $vendorId = null) {
    $commissionRate = 0.10; // 10% platform commission
    $vendorRate = 0.90;     // 90% vendor earnings
    $threshold = 10000;     // KSh 10,000 threshold
    
    // If vendor_id is provided, check threshold
    if ($vendorId !== null) {
        $lifetimeSales = getVendorLifetimeSales($vendorId);
        
        // If vendor hasn't reached threshold, no commission
        if ($lifetimeSales < $threshold) {
            return [
                'total_amount' => floatval($totalAmount),
                'commission_amount' => 0.00,
                'vendor_amount' => floatval($totalAmount), // Vendor keeps 100%
                'threshold_reached' => false,
                'lifetime_sales' => $lifetimeSales,
                'threshold' => $threshold
            ];
        }
    }
    
    // Vendor has exceeded threshold, apply commission
    return [
        'total_amount' => floatval($totalAmount),
        'commission_amount' => round($totalAmount * $commissionRate, 2),
        'vendor_amount' => round($totalAmount * $vendorRate, 2),
        'threshold_reached' => true
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
        
        // Get vendor lifetime sales before this order
        $lifetimeSalesBefore = getVendorLifetimeSales($vendorId);
        
        // Calculate commission amounts (checks threshold internally)
        $commission = calculateCommission($totalAmount, $vendorId);
        
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
        
        // Update vendor lifetime sales (always update, even if no commission)
        updateVendorLifetimeSales($vendorId, $totalAmount);
        
        // If vendor hasn't reached threshold, no commission to process
        if (!$commission['threshold_reached']) {
            // Update advertisement revenue if order came from an ad (even without commission)
            if ($orderDetails && isset($orderDetails['advertisement_id']) && $orderDetails['advertisement_id']) {
                require_once __DIR__ . '/../routes/advertisements.php';
                updateAdRevenue($orderDetails['advertisement_id'], $totalAmount);
            }
            
            // Still update lifetime sales, but don't create commission records
            if (!$inTransaction) {
                $pdo->commit();
            }
            return [
                'success' => true,
                'message' => 'Order processed. No commission applied (vendor below KSh 10,000 threshold)',
                'commission' => $commission,
                'lifetime_sales' => $lifetimeSalesBefore + $totalAmount
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
        
        // Update advertisement revenue if order came from an ad
        if ($orderDetails && isset($orderDetails['advertisement_id']) && $orderDetails['advertisement_id']) {
            require_once __DIR__ . '/../routes/advertisements.php';
            updateAdRevenue($orderDetails['advertisement_id'], $commission['total_amount']);
        }
        
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
