<?php
/**
 * Vendor Price Aggregator
 * Aggregates prices from vendor product listings to create market price data
 * 
 * This is the PRIMARY data source for market prices since KilimoSTAT doesn't have poultry price data.
 * 
 * Usage:
 *   php backend/scripts/aggregate_vendor_prices.php
 * 
 * Should be run daily or weekly via cron job
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/env_loader.php';

// Set timezone
date_default_timezone_set('Africa/Nairobi');

echo "============================================================================\n";
echo "💰 Vendor Price Aggregator\n";
echo "============================================================================\n\n";

try {
    // Check database connection
    echo "📡 Checking database connection...\n";
    $pdo->query("SELECT 1");
    echo "✅ Database connection successful\n\n";
    
    // Step 1: Get all active products from approved vendors
    echo "📦 Step 1: Fetching vendor products...\n";
    
    $sql = "
        SELECT 
            p.id,
            p.name as product_name,
            p.category,
            p.price,
            p.unit,
            p.created_at,
            p.updated_at,
            v.location as vendor_location,
            v.status as vendor_status
        FROM products p
        INNER JOIN vendors v ON p.vendor_id = v.id
        WHERE p.is_active = 1 
        AND v.status = 'approved'
        AND p.price > 0
        ORDER BY p.created_at DESC
    ";
    
    $stmt = $pdo->query($sql);
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "✅ Found " . count($products) . " active products from approved vendors\n\n";
    
    if (empty($products)) {
        echo "⚠️  No products found. Cannot aggregate prices.\n";
        exit(0);
    }
    
    // Step 2: Map product names to standard market price categories
    echo "🔍 Step 2: Mapping products to market price categories...\n";
    
    // Product name mapping (normalize vendor product names to standard categories)
    // This maps to KAMIS product names for consistency
    $productMapping = [
        // Eggs
        'egg' => 'Eggs',
        'eggs' => 'Eggs',
        'tray' => 'Eggs',
        'egg tray' => 'Eggs',
        'egg trays' => 'Eggs',
        
        // Chicken (Live/Whole)
        'chicken' => 'Chicken',
        'live chicken' => 'Chicken',
        'whole chicken' => 'Chicken',
        'chicken live' => 'Chicken',
        
        // Broilers (Meat)
        'broiler' => 'Meat broiler',
        'broilers' => 'Meat broiler',
        'chicken broiler' => 'Meat broiler',
        'broiler meat' => 'Meat broiler',
        'broiler chicken meat' => 'Meat broiler',
        
        // Indigenous Chicken (Meat)
        'indigenous' => 'Meat indiginous chicken',
        'kienyeji' => 'Meat indiginous chicken',
        'local chicken' => 'Meat indiginous chicken',
        'indigenous chicken' => 'Meat indiginous chicken',
        'indigenous meat' => 'Meat indiginous chicken',
        'kienyeji meat' => 'Meat indiginous chicken',
        
        // Duck
        'duck' => 'Duck',
        'duck meat' => 'Duck',
        'duck live' => 'Duck',
        
        // Rabbit (not strictly poultry but related)
        'rabbit' => 'Rabbit meat',
        'rabbit meat' => 'Rabbit meat',
        
        // Layers (Live - not in KAMIS, use vendor data)
        'layer' => 'Poultry (Chicken Layers)',
        'layers' => 'Poultry (Chicken Layers)',
        'laying hen' => 'Poultry (Chicken Layers)',
        'layer chicken' => 'Poultry (Chicken Layers)',
        'layer hen' => 'Poultry (Chicken Layers)',
        
        // Chicks (Not in KAMIS, use vendor data)
        'chick' => 'Day-Old Chicks',
        'chicks' => 'Day-Old Chicks',
        'day old' => 'Day-Old Chicks',
        'day-old' => 'Day-Old Chicks',
        'd.o.c' => 'Day-Old Chicks',
        'day old chick' => 'Day-Old Chicks',
        'day old chicks' => 'Day-Old Chicks',
        
        // Turkey (Not in KAMIS, use vendor data)
        'turkey' => 'Turkey',
        'turkey meat' => 'Turkey',
        'turkey live' => 'Turkey',
        
        // Quail (Not in KAMIS, use vendor data)
        'quail' => 'Quail',
        'quail meat' => 'Quail',
        'quail eggs' => 'Quail Eggs',
        
        // Guinea Fowl (Not in KAMIS, use vendor data)
        'guinea' => 'Guinea Fowl',
        'guinea fowl' => 'Guinea Fowl',
        'guinea fowl meat' => 'Guinea Fowl',
        
        // Poultry Feed (Not in KAMIS, use vendor data)
        'feed' => 'Poultry Feed',
        'chicken feed' => 'Poultry Feed',
        'poultry feed' => 'Poultry Feed',
        'layer feed' => 'Poultry Feed',
        'broiler feed' => 'Poultry Feed',
    ];
    
    // County mapping (normalize vendor locations to standard county names)
    // You may need to expand this based on your actual vendor location data
    $countyMapping = [
        'nairobi' => 'Nairobi',
        'kiambu' => 'Kiambu',
        'nakuru' => 'Nakuru',
        'mombasa' => 'Mombasa',
        'kisumu' => 'Kisumu',
        'eldoret' => 'Uasin Gishu',
        'thika' => 'Kiambu',
        // Add more mappings as needed
    ];
    
    // Step 3: Aggregate prices by product, county, and date
    echo "📊 Step 3: Aggregating prices...\n";
    
    $aggregatedData = [];
    
    foreach ($products as $product) {
        $productName = strtolower(trim($product['product_name']));
        $category = strtolower(trim($product['category'] ?? ''));
        $location = strtolower(trim($product['vendor_location'] ?? ''));
        $price = (float)$product['price'];
        $unit = $product['unit'] ?? 'per unit';
        
        // Skip if price is invalid
        if ($price <= 0 || $price > 1000000) {
            continue;
        }
        
        // Map product name to standard category
        $standardProductName = null;
        foreach ($productMapping as $keyword => $standardName) {
            if (stripos($productName, $keyword) !== false || 
                stripos($category, $keyword) !== false) {
                $standardProductName = $standardName;
                break;
            }
        }
        
        // If no mapping found, use category or product name as-is
        if (!$standardProductName) {
            // Try to infer from category
            if (stripos($category, 'egg') !== false) {
                $standardProductName = 'Eggs';
            } elseif (stripos($category, 'chicken') !== false || stripos($category, 'poultry') !== false) {
                $standardProductName = 'Poultry (Chicken Broilers)';
            } else {
                // Use product name as-is (capitalize first letter)
                $standardProductName = ucfirst($productName);
            }
        }
        
        // Map location to county
        $county = 'National'; // Default
        foreach ($countyMapping as $locationKeyword => $countyName) {
            if (stripos($location, $locationKeyword) !== false) {
                $county = $countyName;
                break;
            }
        }
        
        // If no mapping found, try to extract county from location string
        if ($county === 'National' && !empty($location)) {
            // Common county names in Kenya
            $kenyaCounties = [
                'nairobi', 'kiambu', 'nakuru', 'mombasa', 'kisumu', 'kakamega',
                'baringo', 'bomet', 'bungoma', 'busia', 'elgeyo-marakwet',
                'embu', 'garissa', 'homa bay', 'isiolo', 'kajiado', 'kericho',
                'kilifi', 'kirinyaga', 'kisii', 'kitui', 'kwale', 'laikipia',
                'lamu', 'machakos', 'makueni', 'mandera', 'marsabit', 'meru',
                'migori', 'muranga', 'nyamira', 'nyandarua', 'nyeri', 'samburu',
                'siaya', 'taita taveta', 'tana river', 'tharaka-nithi',
                'trans nzoia', 'turkana', 'uasin gishu', 'vihiga', 'wajir',
                'west pokot'
            ];
            
            foreach ($kenyaCounties as $countyName) {
                if (stripos($location, $countyName) !== false) {
                    $county = ucwords(str_replace('-', ' ', $countyName));
                    break;
                }
            }
        }
        
        // Use product creation date or updated date as the date_reported
        $dateStr = $product['updated_at'] ?? $product['created_at'] ?? date('Y-m-d');
        if (strpos($dateStr, ' ') !== false) {
            $dateStr = substr($dateStr, 0, 10); // Extract date part
        }
        $dateReported = date('Y-m-d', strtotime($dateStr));
        
        // Create aggregation key
        $key = $standardProductName . '|' . $county . '|' . $dateReported;
        
        if (!isset($aggregatedData[$key])) {
            $aggregatedData[$key] = [
                'product_name' => $standardProductName,
                'county' => $county,
                'date_reported' => $dateReported,
                'prices' => [],
                'units' => [],
                'count' => 0
            ];
        }
        
        $aggregatedData[$key]['prices'][] = $price;
        $aggregatedData[$key]['units'][] = $unit;
        $aggregatedData[$key]['count']++;
    }
    
    echo "✅ Aggregated " . count($aggregatedData) . " unique price entries\n\n";
    
    // Step 4: Calculate average prices and prepare for database insertion
    echo "💾 Step 4: Calculating averages and saving to database...\n";
    
    $inserted = 0;
    $updated = 0;
    $skipped = 0;
    
    $stmt = $pdo->prepare("
        INSERT INTO market_prices (product_name, county, price, unit, date_reported, source)
        VALUES (?, ?, ?, ?, ?, 'Vendor Platform')
        ON DUPLICATE KEY UPDATE 
            price = VALUES(price),
            updated_at = CURRENT_TIMESTAMP
    ");
    
    foreach ($aggregatedData as $key => $data) {
        // Calculate average price
        $avgPrice = array_sum($data['prices']) / count($data['prices']);
        
        // Determine most common unit
        $unitCounts = array_count_values($data['units']);
        arsort($unitCounts);
        $mostCommonUnit = key($unitCounts) ?: 'per unit';
        
        // Validate average price
        if ($avgPrice <= 0 || $avgPrice > 1000000) {
            $skipped++;
            continue;
        }
        
        try {
            $stmt->execute([
                $data['product_name'],
                $data['county'],
                round($avgPrice, 2),
                $mostCommonUnit,
                $data['date_reported']
            ]);
            
            if ($stmt->rowCount() > 0) {
                if ($pdo->lastInsertId()) {
                    $inserted++;
                } else {
                    $updated++;
                }
            }
        } catch (PDOException $e) {
            error_log("Error inserting vendor price: " . $e->getMessage());
            $skipped++;
        }
    }
    
    // Update metadata
    $metaStmt = $pdo->prepare("
        UPDATE market_insights_metadata 
        SET last_data_fetch = NOW(),
            total_price_records = (SELECT COUNT(*) FROM market_prices)
        WHERE id = 1
    ");
    $metaStmt->execute();
    
    echo "\n✅ Vendor price aggregation completed!\n";
    echo "📊 Summary:\n";
    echo "  - Products processed: " . count($products) . "\n";
    echo "  - Unique price entries: " . count($aggregatedData) . "\n";
    echo "  - Records inserted: $inserted\n";
    echo "  - Records updated: $updated\n";
    echo "  - Records skipped: $skipped\n";
    echo "  - Total records in database: " . $pdo->query("SELECT COUNT(*) FROM market_prices")->fetchColumn() . "\n";
    
    // Show sample aggregated data
    echo "\n📋 Sample aggregated prices:\n";
    $sampleCount = 0;
    foreach ($aggregatedData as $key => $data) {
        if ($sampleCount >= 5) break;
        $avgPrice = array_sum($data['prices']) / count($data['prices']);
        echo "  - {$data['product_name']} in {$data['county']}: KES " . number_format($avgPrice, 2) . " ({$data['count']} listings, {$data['date_reported']})\n";
        $sampleCount++;
    }
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    error_log("Vendor price aggregation error: " . $e->getMessage());
    exit(1);
}

