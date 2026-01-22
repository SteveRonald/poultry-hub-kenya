<?php
echo "=== COMPREHENSIVE PROJECT ANALYSIS ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n\n";

require_once __DIR__ . '/config/database.php';
global $pdo;

// 1. ANALYZE LATEST PAYMENT TRANSACTION
echo "=== 1. LATEST PAYMENT TRANSACTION ===\n";
$stmt = $pdo->query("
    SELECT * FROM payment_transactions 
    ORDER BY created_at DESC LIMIT 1
");
$transaction = $stmt->fetch(PDO::FETCH_ASSOC);

if ($transaction) {
    echo "Transaction ID: " . $transaction['id'] . "\n";
    echo "Paystack Reference: " . $transaction['paystack_reference'] . "\n";
    echo "Transaction Reference: " . $transaction['transaction_reference'] . "\n";
    echo "Amount: KSH " . number_format($transaction['amount'], 2) . "\n";
    echo "Payment Method: " . $transaction['payment_method'] . "\n";
    echo "Payment Status: " . $transaction['payment_status'] . "\n";
    echo "User ID: " . $transaction['user_id'] . "\n";
    echo "Order ID: " . ($transaction['order_id'] ?? 'NULL') . "\n";
    
    $reference = $transaction['paystack_reference'];
    
    // 2. GET ALL ORDERS FOR THIS PAYMENT REFERENCE
    echo "\n=== 2. ALL ORDERS FOR THIS PAYMENT ===\n";
    $stmt = $pdo->prepare("
        SELECT o.*, p.name as product_name, p.price as product_price,
               v.id as vendor_id_from_vendor_table, v.farm_name,
               up.email as vendor_email, up.full_name as vendor_name
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN vendors v ON o.vendor_id = v.id
        LEFT JOIN user_profiles up ON v.user_id = up.id
        WHERE o.payment_reference = ?
        ORDER BY o.id
    ");
    $stmt->execute([$reference]);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $totalAmount = 0;
    $vendorOrders = [];
    
    foreach ($orders as $order) {
        echo "\nOrder ID: " . $order['id'] . "\n";
        echo "  Order Number: " . $order['order_number'] . "\n";
        echo "  Product: " . $order['product_name'] . "\n";
        echo "  Quantity: " . $order['quantity'] . "\n";
        echo "  Unit Price: KSH " . number_format($order['price'], 2) . "\n";
        echo "  Total Amount: KSH " . number_format($order['total_amount'], 2) . "\n";
        echo "  Payment Method: " . $order['payment_method'] . "\n";
        echo "  Vendor: " . ($order['farm_name'] ?? 'NULL') . " (ID: " . ($order['vendor_id'] ?? 'NULL') . ")\n";
        echo "  Vendor Email: " . ($order['vendor_email'] ?? 'NULL') . "\n";
        
        $totalAmount += $order['total_amount'];
        
        // Group by vendor
        if ($order['vendor_id']) {
            if (!isset($vendorOrders[$order['vendor_id']])) {
                $vendorOrders[$order['vendor_id']] = [
                    'vendor_name' => $order['farm_name'],
                    'vendor_email' => $order['vendor_email'],
                    'orders' => []
                ];
            }
            $vendorOrders[$order['vendor_id']]['orders'][] = $order;
        }
    }
    
    echo "\n=== 3. PAYMENT SUMMARY ===\n";
    echo "Total Orders: " . count($orders) . "\n";
    echo "Total Amount (Aggregated): KSH " . number_format($totalAmount, 2) . "\n";
    echo "Transaction Amount: KSH " . number_format($transaction['amount'], 2) . "\n";
    echo "Amount Match: " . ($totalAmount == $transaction['amount'] ? 'YES ✅' : 'NO ❌') . "\n";
    
    echo "\n=== 4. VENDOR BREAKDOWN ===\n";
    echo "Total Vendors: " . count($vendorOrders) . "\n";
    foreach ($vendorOrders as $vendorId => $vendorData) {
        echo "\nVendor ID: $vendorId\n";
        echo "  Name: " . $vendorData['vendor_name'] . "\n";
        echo "  Email: " . $vendorData['vendor_email'] . "\n";
        echo "  Orders: " . count($vendorData['orders']) . "\n";
        $vendorTotal = 0;
        foreach ($vendorData['orders'] as $order) {
            $vendorTotal += $order['total_amount'];
        }
        echo "  Total Amount: KSH " . number_format($vendorTotal, 2) . "\n";
    }
    
    // 5. CHECK CUSTOMER INFO
    echo "\n=== 5. CUSTOMER INFO ===\n";
    $stmt = $pdo->prepare("
        SELECT up.* FROM user_profiles up
        WHERE up.id = ?
    ");
    $stmt->execute([$transaction['user_id']]);
    $customer = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($customer) {
        echo "Customer ID: " . $customer['id'] . "\n";
        echo "Customer Name: " . $customer['full_name'] . "\n";
        echo "Customer Email: " . $customer['email'] . "\n";
        echo "Customer Phone: " . ($customer['phone'] ?? 'NULL') . "\n";
    }
}

echo "\n=== 6. DATABASE SCHEMA CHECK ===\n";
echo "Checking orders table structure...\n";
$stmt = $pdo->query("DESCRIBE orders");
$columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "Orders table columns:\n";
foreach ($columns as $col) {
    echo "  - " . $col['Field'] . " (" . $col['Type'] . ")\n";
}

echo "\n=== 7. ISSUES IDENTIFIED ===\n";
echo "Issue 1: Payment success page data display\n";
echo "  - Need to verify frontend receives: reference, amount, payment_method\n";
echo "\nIssue 2: Email system\n";
echo "  - Vendor emails: Check if vendors have valid emails\n";
echo "  - Customer email: Must show aggregated total, not single product\n";
echo "  - Order items: Must include all products in email\n";
echo "\nIssue 3: Chatbase widget\n";
echo "  - Need to check Contact page implementation\n";
echo "\nIssue 4: Mobile popup management\n";
echo "  - Hide chatbase widget popup on mobile\n";
echo "  - Keep custom chatbot popup on mobile\n";

echo "\n=== ANALYSIS COMPLETE ===\n";
?>
