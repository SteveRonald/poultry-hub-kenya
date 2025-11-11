<?php
/**
 * Market Insights API Routes
 * Handles fetching market prices, predictions, and filtering
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/env_loader.php';

/**
 * Get market prices (actual/historical data)
 * Query params: product_name, county, start_date, end_date, limit
 */
function handleGetMarketPrices() {
    global $pdo;
    
    try {
        $productName = $_GET['product_name'] ?? null;
        $county = $_GET['county'] ?? null;
        $startDate = $_GET['start_date'] ?? null;
        $endDate = $_GET['end_date'] ?? null;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 1000;
        
        // Build query
        $query = "SELECT id, product_name, county, price, unit, date_reported, source, created_at 
                  FROM market_prices WHERE 1=1";
        $params = [];
        
        if ($productName) {
            $query .= " AND product_name = ?";
            $params[] = $productName;
        }
        
        if ($county) {
            $query .= " AND county = ?";
            $params[] = $county;
        }
        
        if ($startDate) {
            $query .= " AND date_reported >= ?";
            $params[] = $startDate;
        }
        
        if ($endDate) {
            $query .= " AND date_reported <= ?";
            $params[] = $endDate;
        }
        
        $query .= " ORDER BY date_reported DESC, product_name, county LIMIT ?";
        $params[] = $limit;
        
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $prices = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get metadata
        $metaStmt = $pdo->query("SELECT total_price_records, last_data_fetch FROM market_insights_metadata WHERE id = 1");
        $metadata = $metaStmt->fetch(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $prices,
            'count' => count($prices),
            'metadata' => $metadata
        ]);
        
    } catch (PDOException $e) {
        error_log("Error fetching market prices: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to fetch market prices'
        ]);
    }
}

/**
 * Get predicted prices (AI forecasts)
 * Query params: product_name, county, start_date, end_date, model_type
 */
function handleGetPredictedPrices() {
    global $pdo;
    
    try {
        $productName = $_GET['product_name'] ?? null;
        $county = $_GET['county'] ?? null;
        $startDate = $_GET['start_date'] ?? null;
        $endDate = $_GET['end_date'] ?? null;
        $modelType = $_GET['model_type'] ?? 'ensemble';
        
        // Build query
        $query = "SELECT id, product_name, county, predicted_price, prediction_date, 
                         model_type, confidence_score, prophet_prediction, arima_prediction, generated_on
                  FROM predicted_prices WHERE 1=1";
        $params = [];
        
        if ($productName) {
            $query .= " AND product_name = ?";
            $params[] = $productName;
        }
        
        if ($county) {
            $query .= " AND county = ?";
            $params[] = $county;
        }
        
        if ($startDate) {
            $query .= " AND prediction_date >= ?";
            $params[] = $startDate;
        }
        
        if ($endDate) {
            $query .= " AND prediction_date <= ?";
            $params[] = $endDate;
        }
        
        if ($modelType && $modelType !== 'all') {
            $query .= " AND model_type = ?";
            $params[] = $modelType;
        }
        
        $query .= " ORDER BY prediction_date ASC, product_name, county";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $predictions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get metadata
        $metaStmt = $pdo->query("SELECT total_prediction_records, last_prediction_run, 
                                        prophet_accuracy, arima_accuracy, ensemble_accuracy 
                                 FROM market_insights_metadata WHERE id = 1");
        $metadata = $metaStmt->fetch(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $predictions,
            'count' => count($predictions),
            'metadata' => $metadata
        ]);
        
    } catch (PDOException $e) {
        error_log("Error fetching predicted prices: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to fetch predicted prices'
        ]);
    }
}

/**
 * Get combined prices (actual + predicted) for chart display
 * Returns standard price (national average) if no filters applied
 */
function handleGetCombinedPrices() {
    global $pdo;
    
    try {
        $productName = $_GET['product_name'] ?? null;
        $county = $_GET['county'] ?? null;
        $daysBack = isset($_GET['days_back']) ? (int)$_GET['days_back'] : 90;
        $daysForward = isset($_GET['days_forward']) ? (int)$_GET['days_forward'] : 30;
        
        $startDate = date('Y-m-d', strtotime("-$daysBack days"));
        $endDate = date('Y-m-d', strtotime("+$daysForward days"));
        
        // If no filters, get standard price (national average)
        if (!$productName && !$county) {
            // Get all available products dynamically from database (exclude Rabbit meat - not poultry)
            $productsStmt = $pdo->query("SELECT DISTINCT product_name FROM market_prices 
                                         WHERE product_name != 'Rabbit meat' 
                                         ORDER BY product_name");
            $allProducts = $productsStmt->fetchAll(PDO::FETCH_COLUMN);
            
            $result = [
                'actual_prices' => [],
                'predicted_prices' => [],
                'standard_prices' => [],
                'filters' => [
                    'product_name' => null,
                    'county' => null,
                    'is_standard' => true
                ]
            ];
            
            // Get latest national average for each product
            foreach ($allProducts as $product) {
                // Get latest actual price (national average) - use last 30 days for better accuracy
                $stmt = $pdo->prepare("
                    SELECT AVG(price) as avg_price, MAX(date_reported) as latest_date, COUNT(*) as record_count
                    FROM market_prices 
                    WHERE product_name = ? 
                    AND date_reported >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                    GROUP BY product_name
                ");
                $stmt->execute([$product]);
                $avg = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($avg && $avg['avg_price'] && $avg['record_count'] > 0) {
                    // Get the most common unit for this product
                    $unitStmt = $pdo->prepare("
                        SELECT unit, COUNT(*) as count 
                        FROM market_prices 
                        WHERE product_name = ? 
                        AND date_reported >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                        GROUP BY unit 
                        ORDER BY count DESC 
                        LIMIT 1
                    ");
                    $unitStmt->execute([$product]);
                    $unitRow = $unitStmt->fetch(PDO::FETCH_ASSOC);
                    $productUnit = $unitRow['unit'] ?? 'per unit';
                    
                    $result['standard_prices'][] = [
                        'product_name' => $product,
                        'price' => round((float)$avg['avg_price'], 2),
                        'date' => $avg['latest_date'],
                        'type' => 'national_average',
                        'unit' => $productUnit,
                        'record_count' => (int)$avg['record_count']
                    ];
                }
            }
            
            // Sort by product name for consistent display
            usort($result['standard_prices'], function($a, $b) {
                return strcmp($a['product_name'], $b['product_name']);
            });
            
            // Get metadata
            try {
                $metaStmt = $pdo->query("SELECT total_price_records, last_data_fetch, 
                                                total_prediction_records, last_prediction_run,
                                                prophet_accuracy, arima_accuracy, ensemble_accuracy 
                                         FROM market_insights_metadata WHERE id = 1");
                $metadata = $metaStmt->fetch(PDO::FETCH_ASSOC);
                $result['metadata'] = $metadata ?: null;
            } catch (PDOException $e) {
                // Metadata table might not exist yet, that's okay
                $result['metadata'] = null;
            }
            
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $result
            ]);
            return;
        }
        
        // Get time period for aggregation (daily, weekly, monthly, yearly)
        $timePeriod = $_GET['time_period'] ?? 'daily';
        
        // Get actual prices with unit
        // First, try to get data within the selected time period
        // Apply aggregation based on time_period parameter
        if ($timePeriod === 'daily') {
            // Daily: No aggregation, return individual records
            $actualQuery = "SELECT date_reported as date, price, product_name, county, unit, 'actual' as type
                            FROM market_prices 
                            WHERE date_reported >= ? AND date_reported <= ?";
            $actualParams = [$startDate, date('Y-m-d')];
            
            if ($productName) {
                $actualQuery .= " AND product_name = ?";
                $actualParams[] = $productName;
            }
            
            if ($county) {
                $actualQuery .= " AND county = ?";
                $actualParams[] = $county;
            }
            
            $actualQuery .= " ORDER BY date_reported ASC";
            
            $stmt = $pdo->prepare($actualQuery);
            $stmt->execute($actualParams);
            $actualPrices = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            // Weekly, Monthly, or Yearly: Aggregate by period
            $dateFormat = match($timePeriod) {
                'weekly' => "DATE_FORMAT(date_reported, '%Y-%u')", // Year-Week
                'monthly' => "DATE_FORMAT(date_reported, '%Y-%m')", // Year-Month
                'yearly' => "DATE_FORMAT(date_reported, '%Y')", // Year
                default => "DATE_FORMAT(date_reported, '%Y-%m-%d')" // Daily fallback
            };
            
            $dateSelect = match($timePeriod) {
                'weekly' => "DATE_ADD(DATE_FORMAT(date_reported, '%Y-%m-%d'), INTERVAL -WEEKDAY(date_reported) DAY) as date", // Start of week (Monday)
                'monthly' => "DATE_FORMAT(date_reported, '%Y-%m-01') as date", // First day of month
                'yearly' => "DATE_FORMAT(date_reported, '%Y-01-01') as date", // First day of year
                default => "date_reported as date"
            };
            
            $actualQuery = "SELECT 
                            {$dateSelect},
                            AVG(price) as price,
                            product_name, 
                            county, 
                            unit, 
                            'actual' as type,
                            COUNT(*) as record_count
                            FROM market_prices 
                            WHERE date_reported >= ? AND date_reported <= ?";
            $actualParams = [$startDate, date('Y-m-d')];
            
            if ($productName) {
                $actualQuery .= " AND product_name = ?";
                $actualParams[] = $productName;
            }
            
            if ($county) {
                $actualQuery .= " AND county = ?";
                $actualParams[] = $county;
            }
            
            $actualQuery .= " GROUP BY {$dateFormat}, product_name, county, unit";
            $actualQuery .= " ORDER BY date ASC";
            
            $stmt = $pdo->prepare($actualQuery);
            $stmt->execute($actualParams);
            $actualPrices = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Convert date strings to proper format
            foreach ($actualPrices as &$price) {
                $price['date'] = date('Y-m-d', strtotime($price['date']));
                $price['price'] = (float)$price['price']; // Ensure price is float
            }
        }
        
        // If no data in selected time period but filters are applied, 
        // get ALL available data for that product/county combination
        $dataOutsideRange = false;
        if (empty($actualPrices) && ($productName || $county)) {
            $fallbackQuery = "SELECT date_reported as date, price, product_name, county, unit, 'actual' as type
                              FROM market_prices 
                              WHERE 1=1";
            $fallbackParams = [];
            
            if ($productName) {
                $fallbackQuery .= " AND product_name = ?";
                $fallbackParams[] = $productName;
            }
            
            if ($county) {
                $fallbackQuery .= " AND county = ?";
                $fallbackParams[] = $county;
            }
            
            $fallbackQuery .= " ORDER BY date_reported ASC LIMIT 1000";
            
            $stmt = $pdo->prepare($fallbackQuery);
            $stmt->execute($fallbackParams);
            $actualPrices = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (!empty($actualPrices)) {
                $dataOutsideRange = true;
            }
        }
        
        // Get the most common unit for this product (for display purposes)
        $defaultUnit = 'per unit';
        if ($productName) {
            $unitQuery = "SELECT unit, COUNT(*) as count 
                          FROM market_prices 
                          WHERE product_name = ? AND date_reported >= ? 
                          AND unit IS NOT NULL AND unit != ''
                          GROUP BY unit 
                          ORDER BY count DESC 
                          LIMIT 1";
            $unitStmt = $pdo->prepare($unitQuery);
            $unitStmt->execute([$productName, $startDate]);
            $unitRow = $unitStmt->fetch(PDO::FETCH_ASSOC);
            if ($unitRow) {
                $defaultUnit = $unitRow['unit'];
            }
        } else {
            // If no product selected, try to get unit from actual prices
            if (!empty($actualPrices) && isset($actualPrices[0]['unit'])) {
                $defaultUnit = $actualPrices[0]['unit'];
            } else {
                // Fallback: get most common unit from all data
                $unitStmt = $pdo->prepare("SELECT unit FROM market_prices WHERE unit IS NOT NULL AND unit != '' LIMIT 1");
                $unitStmt->execute();
                $defaultUnit = $unitStmt->fetchColumn() ?: 'per unit';
            }
        }
        
        // Get predicted prices with aggregation
        if ($timePeriod === 'daily') {
            // Daily: No aggregation
            $predQuery = "SELECT prediction_date as date, predicted_price as price, product_name, county, 'predicted' as type,
                                 model_type, confidence_score
                          FROM predicted_prices 
                          WHERE prediction_date >= ? AND prediction_date <= ?";
            $predParams = [date('Y-m-d', strtotime('+1 day')), $endDate];
            
            if ($productName) {
                $predQuery .= " AND product_name = ?";
                $predParams[] = $productName;
            }
            
            if ($county) {
                $predQuery .= " AND county = ?";
                $predParams[] = $county;
            }
            
            $predQuery .= " AND model_type = 'ensemble' ORDER BY prediction_date ASC";
            
            $stmt = $pdo->prepare($predQuery);
            $stmt->execute($predParams);
            $predictedPrices = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            // Weekly, Monthly, or Yearly: Aggregate by period
            $dateFormat = match($timePeriod) {
                'weekly' => "DATE_FORMAT(prediction_date, '%Y-%u')",
                'monthly' => "DATE_FORMAT(prediction_date, '%Y-%m')",
                'yearly' => "DATE_FORMAT(prediction_date, '%Y')",
                default => "DATE_FORMAT(prediction_date, '%Y-%m-%d')"
            };
            
            $dateSelect = match($timePeriod) {
                'weekly' => "DATE_ADD(DATE_FORMAT(prediction_date, '%Y-%m-%d'), INTERVAL -WEEKDAY(prediction_date) DAY) as date",
                'monthly' => "DATE_FORMAT(prediction_date, '%Y-%m-01') as date",
                'yearly' => "DATE_FORMAT(prediction_date, '%Y-01-01') as date",
                default => "prediction_date as date"
            };
            
            $predQuery = "SELECT 
                          {$dateSelect},
                          AVG(predicted_price) as price,
                          product_name, 
                          county, 
                          'predicted' as type,
                          model_type,
                          AVG(confidence_score) as confidence_score,
                          COUNT(*) as record_count
                          FROM predicted_prices 
                          WHERE prediction_date >= ? AND prediction_date <= ?";
            $predParams = [date('Y-m-d', strtotime('+1 day')), $endDate];
            
            if ($productName) {
                $predQuery .= " AND product_name = ?";
                $predParams[] = $productName;
            }
            
            if ($county) {
                $predQuery .= " AND county = ?";
                $predParams[] = $county;
            }
            
            $predQuery .= " AND model_type = 'ensemble'";
            $predQuery .= " GROUP BY {$dateFormat}, product_name, county";
            $predQuery .= " ORDER BY date ASC";
            
            $stmt = $pdo->prepare($predQuery);
            $stmt->execute($predParams);
            $predictedPrices = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Convert date strings to proper format
            foreach ($predictedPrices as &$price) {
                $price['date'] = date('Y-m-d', strtotime($price['date']));
                $price['price'] = (float)$price['price'];
                $price['confidence_score'] = (float)$price['confidence_score'];
            }
        }
        
        // Get metadata
        $metadata = null;
        try {
            $metaStmt = $pdo->query("SELECT total_price_records, last_data_fetch, 
                                            total_prediction_records, last_prediction_run,
                                            prophet_accuracy, arima_accuracy, ensemble_accuracy 
                                     FROM market_insights_metadata WHERE id = 1");
            $metadata = $metaStmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            // Metadata table might not exist yet, that's okay
            error_log("Metadata fetch error: " . $e->getMessage());
        }
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => [
                'actual_prices' => $actualPrices,
                'predicted_prices' => $predictedPrices,
                'filters' => [
                    'product_name' => $productName,
                    'county' => $county,
                    'is_standard' => false,
                    'time_period' => $timePeriod
                ],
                'unit' => $defaultUnit, // Most common unit for the selected product
                'metadata' => $metadata,
                'data_outside_range' => $dataOutsideRange // Flag indicating data is outside selected time period
            ]
        ]);
        
    } catch (PDOException $e) {
        error_log("Error fetching combined prices: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to fetch combined prices'
        ]);
    }
}

/**
 * Get available products and counties for filtering
 * If product_name is provided, only return counties that have data for that product
 */
/**
 * Calculate valid data points for a product-county combination
 * Valid data points = unique dates with positive prices (after filtering outliers)
 * This simulates what the Python prediction script does
 */
function calculateValidDataPoints($pdo, $productName, $county) {
    // Minimum threshold for predictions (matches Python script)
    $MIN_DATA_POINTS = 10;
    
    // Get unique dates with valid prices (positive, not null)
    // This is a simplified version - the Python script also removes outliers
    $stmt = $pdo->prepare("
        SELECT COUNT(DISTINCT date_reported) as unique_dates,
               COUNT(*) as total_records
        FROM market_prices 
        WHERE product_name = ? 
        AND county = ? 
        AND price > 0 
        AND price IS NOT NULL
        AND date_reported >= '2022-01-01'
    ");
    $stmt->execute([$productName, $county]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $uniqueDates = (int)($result['unique_dates'] ?? 0);
    $totalRecords = (int)($result['total_records'] ?? 0);
    
    // For simplicity, use unique_dates as valid data points
    // In reality, the Python script also removes outliers (beyond 3 std dev)
    // But this gives us a good approximation
    $validDataPoints = $uniqueDates;
    
    return [
        'valid_data_points' => $validDataPoints,
        'total_records' => $totalRecords,
        'unique_dates' => $uniqueDates,
        'is_qualified' => $validDataPoints >= $MIN_DATA_POINTS,
        'min_required' => $MIN_DATA_POINTS
    ];
}

function handleGetFilterOptions() {
    global $pdo;
    
    try {
        $productName = $_GET['product_name'] ?? null;
        $MIN_DATA_POINTS = 10; // Matches Python script threshold
        
        // Get unique products (exclude Rabbit meat - it's not poultry)
        $productsStmt = $pdo->query("SELECT DISTINCT product_name FROM market_prices 
                                     WHERE product_name != 'Rabbit meat' 
                                     ORDER BY product_name");
        $allProducts = $productsStmt->fetchAll(PDO::FETCH_COLUMN);
        
        // Calculate qualification status for each product
        $products = [];
        foreach ($allProducts as $prod) {
            // Get total data count for this product
            $stmt = $pdo->prepare("
                SELECT COUNT(DISTINCT county) as county_count,
                       COUNT(*) as total_records,
                       COUNT(DISTINCT date_reported) as unique_dates
                FROM market_prices 
                WHERE product_name = ? 
                AND price > 0 
                AND date_reported >= '2022-01-01'
            ");
            $stmt->execute([$prod]);
            $stats = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Check if product has at least one qualified county
            $qualifiedCountiesStmt = $pdo->prepare("
                SELECT COUNT(DISTINCT county) as qualified_count
                FROM (
                    SELECT county, COUNT(DISTINCT date_reported) as unique_dates
                    FROM market_prices 
                    WHERE product_name = ? 
                    AND price > 0 
                    AND date_reported >= '2022-01-01'
                    GROUP BY county
                    HAVING unique_dates >= ?
                ) as qualified
            ");
            $qualifiedCountiesStmt->execute([$prod, $MIN_DATA_POINTS]);
            $qualifiedCount = (int)$qualifiedCountiesStmt->fetch(PDO::FETCH_COLUMN);
            
            $products[] = [
                'name' => $prod,
                'has_data' => true,
                'total_records' => (int)($stats['total_records'] ?? 0),
                'unique_dates' => (int)($stats['unique_dates'] ?? 0),
                'county_count' => (int)($stats['county_count'] ?? 0),
                'qualified_county_count' => $qualifiedCount,
                'is_qualified' => $qualifiedCount > 0 // Product is qualified if it has at least one qualified county
            ];
        }
        
        // Sort products: qualified first, then non-qualified, both alphabetically
        usort($products, function($a, $b) {
            if ($a['is_qualified'] !== $b['is_qualified']) {
                return $b['is_qualified'] ? 1 : -1; // Qualified first
            }
            return strcmp($a['name'], $b['name']); // Alphabetical
        });
        
        // Get counties - if product is selected, show counties with data for that product
        // Otherwise, show all counties
        if ($productName && $productName !== 'all') {
            $countiesStmt = $pdo->prepare("
                SELECT DISTINCT county, COUNT(*) as total_records
                FROM market_prices 
                WHERE product_name = ? 
                GROUP BY county 
                ORDER BY county
            ");
            $countiesStmt->execute([$productName]);
            $countiesWithData = $countiesStmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Calculate qualification status for each county
            $counties = [];
            foreach ($countiesWithData as $row) {
                $stats = calculateValidDataPoints($pdo, $productName, $row['county']);
                
                $counties[] = [
                    'name' => $row['county'],
                    'has_data' => true,
                    'total_records' => (int)$row['total_records'],
                    'valid_data_points' => $stats['valid_data_points'],
                    'unique_dates' => $stats['unique_dates'],
                    'is_qualified' => $stats['is_qualified'],
                    'min_required' => $stats['min_required']
                ];
            }
        } else {
            // Get all counties with data
            $countiesStmt = $pdo->query("
                SELECT DISTINCT county, COUNT(*) as total_records
                FROM market_prices 
                GROUP BY county 
                ORDER BY county
            ");
            $countiesWithData = $countiesStmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Calculate qualification status for each county (using most common product or all products)
            $counties = [];
            foreach ($countiesWithData as $row) {
                // Get the most common product for this county
                $productStmt = $pdo->prepare("
                    SELECT product_name, COUNT(*) as count
                    FROM market_prices 
                    WHERE county = ?
                    GROUP BY product_name
                    ORDER BY count DESC
                    LIMIT 1
                ");
                $productStmt->execute([$row['county']]);
                $mostCommonProduct = $productStmt->fetch(PDO::FETCH_COLUMN);
                
                // Calculate stats using the most common product
                if ($mostCommonProduct) {
                    $stats = calculateValidDataPoints($pdo, $mostCommonProduct, $row['county']);
                } else {
                    // Fallback: calculate across all products
                    $stats = [
                        'valid_data_points' => 0,
                        'total_records' => (int)$row['total_records'],
                        'unique_dates' => 0,
                        'is_qualified' => false,
                        'min_required' => $MIN_DATA_POINTS
                    ];
                }
                
                $counties[] = [
                    'name' => $row['county'],
                    'has_data' => true,
                    'total_records' => (int)$row['total_records'],
                    'valid_data_points' => $stats['valid_data_points'],
                    'unique_dates' => $stats['unique_dates'],
                    'is_qualified' => $stats['is_qualified'],
                    'min_required' => $stats['min_required']
                ];
            }
        }
        
        // Sort counties: qualified first, then non-qualified, both alphabetically
        usort($counties, function($a, $b) {
            if ($a['is_qualified'] !== $b['is_qualified']) {
                return $b['is_qualified'] ? 1 : -1; // Qualified first
            }
            return strcmp($a['name'], $b['name']); // Alphabetical
        });
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => [
                'products' => $products,
                'counties' => $counties,
                'min_data_points_required' => $MIN_DATA_POINTS
            ]
        ]);
        
    } catch (PDOException $e) {
        error_log("Error fetching filter options: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to fetch filter options'
        ]);
    }
}

