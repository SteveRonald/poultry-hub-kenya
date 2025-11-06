<?php
/**
 * Utility script to reprocess commissions for delivered orders that don't have earnings records
 * Run this script to fix existing orders that weren't processed correctly
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/commission.php';

try {
    // Find all delivered orders that don't have vendor_earnings records
    $stmt = $pdo->query("
        SELECT o.id, o.total_amount, p.vendor_id, o.order_number
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.status = 'delivered'
        AND NOT EXISTS (
            SELECT 1 FROM vendor_earnings ve WHERE ve.order_id = o.id
        )
    ");
    
    $ordersToProcess = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $processed = 0;
    $errors = 0;
    
    echo "Found " . count($ordersToProcess) . " delivered orders without earnings records.\n";
    echo "Processing commissions...\n\n";
    
    foreach ($ordersToProcess as $order) {
        try {
            $result = processCommission(
                $order['id'],
                $order['vendor_id'],
                $order['total_amount']
            );
            
            if ($result['success']) {
                $processed++;
                echo "✓ Processed order #{$order['order_number']} (ID: {$order['id']})\n";
            } else {
                $errors++;
                echo "✗ Failed to process order #{$order['order_number']} (ID: {$order['id']}): {$result['message']}\n";
            }
        } catch (Exception $e) {
            $errors++;
            echo "✗ Error processing order #{$order['order_number']} (ID: {$order['id']}): " . $e->getMessage() . "\n";
        }
    }
    
    echo "\n";
    echo "Processing complete!\n";
    echo "Successfully processed: {$processed}\n";
    echo "Errors: {$errors}\n";
    
} catch (Exception $e) {
    echo "Fatal error: " . $e->getMessage() . "\n";
    exit(1);
}
?>

