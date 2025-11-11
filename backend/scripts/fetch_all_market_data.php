<?php
/**
 * Fetch All Market Data
 * Orchestrates data collection from multiple sources:
 * 1. Vendor Platform (aggregate_vendor_prices.php)
 * 2. KAMIS (scrape_kamis_prices.php)
 * 
 * This script is called by the cron job: backend/cron/fetch_market_prices.php
 * 
 * Usage:
 *   php backend/scripts/fetch_all_market_data.php
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/env_loader.php';

// Set timezone
date_default_timezone_set('Africa/Nairobi');

echo "============================================================================\n";
echo "📊 Market Data Collection - Orchestrator\n";
echo "============================================================================\n\n";

$startTime = microtime(true);
$results = [
    'vendor' => ['success' => false, 'message' => ''],
    'kamis' => ['success' => false, 'message' => '']
];

// 1. Aggregate Vendor Prices
echo "1️⃣  Aggregating Vendor Platform Prices...\n";
echo str_repeat("-", 80) . "\n";

// Execute vendor aggregation script
$vendorScript = __DIR__ . '/aggregate_vendor_prices.php';
if (file_exists($vendorScript)) {
    // Use output buffering to capture script output
    ob_start();
    $vendorReturnCode = 0;
    
    try {
        // Include the script - it will output directly and may exit on error
        include $vendorScript;
        $vendorOutput = ob_get_clean();
        echo $vendorOutput;
        $results['vendor'] = ['success' => true, 'message' => 'Vendor prices aggregated successfully'];
    } catch (Exception $e) {
        ob_end_clean();
        $results['vendor'] = ['success' => false, 'message' => $e->getMessage()];
        echo "⚠️  Vendor price aggregation failed: " . $e->getMessage() . "\n";
    } catch (Error $e) {
        ob_end_clean();
        $results['vendor'] = ['success' => false, 'message' => $e->getMessage()];
        echo "⚠️  Vendor price aggregation failed: " . $e->getMessage() . "\n";
    }
} else {
    $results['vendor'] = ['success' => false, 'message' => 'Script file not found'];
    echo "⚠️  Vendor aggregation script not found: $vendorScript\n";
}

echo "\n";

// 2. Scrape KAMIS Prices
echo "2️⃣  Scraping KAMIS Prices...\n";
echo str_repeat("-", 80) . "\n";

// Execute KAMIS scraping script
$kamisScript = __DIR__ . '/scrape_kamis_prices.php';
if (file_exists($kamisScript)) {
    // Use output buffering to capture script output
    ob_start();
    
    try {
        // Include the script - it will output directly and may exit on error
        include $kamisScript;
        $kamisOutput = ob_get_clean();
        echo $kamisOutput;
        $results['kamis'] = ['success' => true, 'message' => 'KAMIS prices scraped successfully'];
    } catch (Exception $e) {
        ob_end_clean();
        $results['kamis'] = ['success' => false, 'message' => $e->getMessage()];
        echo "⚠️  KAMIS scraping failed: " . $e->getMessage() . "\n";
    } catch (Error $e) {
        ob_end_clean();
        $results['kamis'] = ['success' => false, 'message' => $e->getMessage()];
        echo "⚠️  KAMIS scraping failed: " . $e->getMessage() . "\n";
    }
} else {
    $results['kamis'] = ['success' => false, 'message' => 'Script file not found'];
    echo "⚠️  KAMIS scraping script not found: $kamisScript\n";
}

echo "\n";

// Summary
$endTime = microtime(true);
$executionTime = round($endTime - $startTime, 2);

echo "============================================================================\n";
echo "📊 Summary\n";
echo "============================================================================\n";
echo "Execution time: {$executionTime} seconds\n";
echo "Vendor prices: " . ($results['vendor']['success'] ? '✅ Success' : '❌ Failed') . "\n";
echo "KAMIS prices: " . ($results['kamis']['success'] ? '✅ Success' : '❌ Failed') . "\n";

// Get final statistics
try {
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM market_prices");
    $totalRecords = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    echo "Total price records in database: " . number_format($totalRecords) . "\n";
    
    $stmt = $pdo->query("SELECT last_data_fetch FROM market_insights_metadata WHERE id = 1");
    $lastFetch = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($lastFetch && $lastFetch['last_data_fetch']) {
        echo "Last data fetch: " . $lastFetch['last_data_fetch'] . "\n";
    }
} catch (Exception $e) {
    echo "⚠️  Could not fetch statistics: " . $e->getMessage() . "\n";
}

echo "============================================================================\n";

// Exit with appropriate code
if ($results['vendor']['success'] || $results['kamis']['success']) {
    exit(0); // At least one source succeeded
} else {
    exit(1); // Both sources failed
}

