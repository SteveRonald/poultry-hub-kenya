<?php
/**
 * KAMIS Price Scraper
 * Scrapes poultry prices from KAMIS (Kenya Agricultural Market Information System)
 * 
 * Source: https://www.kamis.co.ke/market-reports/
 * 
 * Usage:
 *   php backend/scripts/scrape_kamis_prices.php
 * 
 * Should be run weekly via cron job (KAMIS updates weekly)
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/env_loader.php';

// Set timezone
date_default_timezone_set('Africa/Nairobi');

echo "============================================================================\n";
echo "🌐 KAMIS Price Scraper\n";
echo "============================================================================\n\n";

// KAMIS website URLs (Official URLs based on research)
$kamisBaseUrl = "https://kamis.kilimo.go.ke";
$kamisReportsUrl = $kamisBaseUrl . "/site/market_search"; // Market search page
$kamisAboutUrl = $kamisBaseUrl . "/site/about"; // About page (for testing)

// KAMIS Poultry Product IDs (verified with comprehensive testing)
// Only TRUE poultry products are included (rabbit is NOT poultry)
$poultryProductIds = [
    72 => 'Eggs',                    // 9,140+ records (2022-2025)
    75 => 'Meat indiginous chicken', // 186+ records (2022-2025)
    76 => 'Meat broiler',            // 391+ records (2022-2025)
    227 => 'Chicken',                // 20,946+ records (2022-2025) - live/whole chicken
    251 => 'Duck',                   // 393+ records (2022-2025)
    // Note: Rabbit (ID: 210) is NOT poultry - excluded
];

// Note: KAMIS provides price data for the above TRUE poultry products
// Other poultry products NOT available in KAMIS (day-old chicks, turkey, quail, guinea fowl, etc.) 
// should be sourced from:
// 1. Vendor platform data (via aggregate_vendor_prices.php) - PRIMARY SOURCE for missing products
// 2. Other market data sources

/**
 * Fetch HTML content from URL
 */
function fetchHtml($url, $verifySsl = false, $postData = null, $timeout = 90) {
    $ch = curl_init();
    $options = [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout, // Increased timeout for large datasets
        CURLOPT_CONNECTTIMEOUT => 30, // Connection timeout
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_SSL_VERIFYPEER => $verifySsl,
        CURLOPT_SSL_VERIFYHOST => $verifySsl ? 2 : 0,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language: en-US,en;q=0.9',
            'Accept-Encoding: gzip, deflate, br',
            'Connection: keep-alive',
            'Upgrade-Insecure-Requests: 1',
        ],
        CURLOPT_ENCODING => '', // Accept all encodings
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    ];
    
    // If POST data provided, use POST method
    if ($postData !== null) {
        $options[CURLOPT_POST] = true;
        $options[CURLOPT_POSTFIELDS] = $postData;
    }
    
    curl_setopt_array($ch, $options);
    
    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    $effectiveUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    curl_close($ch);
    
    if ($error && !$html) {
        throw new Exception("cURL error: $error");
    }
    
    if ($httpCode !== 200) {
        throw new Exception("HTTP error: $httpCode for URL: $url (Effective URL: $effectiveUrl)");
    }
    
    if (empty($html)) {
        throw new Exception("Empty response from URL: $url");
    }
    
    return $html;
}

/**
 * Parse HTML table to extract price data from KAMIS
 * KAMIS table structure: Market, Commodity, Classification, Grade, Sex, Wholesale, Retail, Supply Volume, County, Date
 */
function parseKamisTable($html) {
    $prices = [];
    
    // Poultry product mappings (based on KAMIS product IDs and actual commodity names)
    // Maps KAMIS commodity names to our standard product names
    $poultryProducts = [
        // Eggs
        'eggs' => 'Eggs',
        'egg' => 'Eggs',
        
        // Chicken (live/whole) - ID 227
        'chicken' => 'Chicken',
        'poultry' => 'Chicken', // Sometimes KAMIS uses "Poultry" for live chicken
        
        // Meat broiler - ID 76
        'meat broiler' => 'Meat broiler',
        'broiler' => 'Meat broiler',
        'broilers' => 'Meat broiler',
        'chicken broiler' => 'Meat broiler',
        'broiler meat' => 'Meat broiler',
        'broiler chicken' => 'Meat broiler',
        
        // Meat indiginous chicken - ID 75 (note: KAMIS uses "Indiginous" not "Indigenous")
        'meat indiginous chicken' => 'Meat indiginous chicken',
        'meat indigenous chicken' => 'Meat indiginous chicken',
        'indiginous chicken' => 'Meat indiginous chicken',
        'indigenous chicken' => 'Meat indiginous chicken',
        'indigenous' => 'Meat indiginous chicken',
        'indiginous' => 'Meat indiginous chicken',
        'kienyeji' => 'Meat indiginous chicken',
        'local chicken' => 'Meat indiginous chicken',
        'meat indiginous' => 'Meat indiginous chicken',
        'meat indigenous' => 'Meat indiginous chicken',
        
        // Duck - ID 251
        'duck' => 'Duck',
        'duck meat' => 'Duck',
        'ducks' => 'Duck',
        
        // Note: Rabbit is NOT poultry - excluded from poultry products
        
        // Additional mappings for variations
        'poultry (chicken broilers)' => 'Meat broiler',
        'poultry chicken' => 'Chicken',
    ];
    
    // Find the main data table (KAMIS uses table with class "table table-bordered table-condensed")
    if (preg_match('/<table[^>]*class=["\'][^"\']*table[^"\']*table-bordered[^"\']*[^>]*>(.*?)<\/table>/is', $html, $tableMatch)) {
        $tableHtml = $tableMatch[1];
        
        // Extract table rows
        if (preg_match_all('/<tr[^>]*>(.*?)<\/tr>/is', $tableHtml, $rowMatches)) {
            $headers = [];
            $headerFound = false;
            
            foreach ($rowMatches[1] as $rowIndex => $rowHtml) {
                // Extract cells (td or th)
                if (preg_match_all('/<t[dh][^>]*>(.*?)<\/t[dh]>/is', $rowHtml, $cellMatches)) {
                    $cells = array_map(function($cell) {
                        // Clean HTML and decode entities
                        $cell = html_entity_decode($cell, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                        return trim(strip_tags($cell));
                    }, $cellMatches[1]);
                    
                    // Skip empty rows
                    if (empty(array_filter($cells))) {
                        continue;
                    }
                    
                    // First non-empty row is usually headers
                    if (!$headerFound && $rowIndex === 0) {
                        $headers = array_map('strtolower', $cells);
                        $headerFound = true;
                        
                        // Find column indices
                        $marketIdx = array_search('market', $headers);
                        $commodityIdx = array_search('commodity', $headers);
                        $wholesaleIdx = array_search('wholesale', $headers);
                        $retailIdx = array_search('retail', $headers);
                        $countyIdx = array_search('county', $headers);
                        $dateIdx = array_search('date', $headers);
                        
                        continue;
                    }
                    
                    // Extract data from cells
                    $market = isset($cells[$marketIdx]) ? trim($cells[$marketIdx]) : '';
                    $commodity = isset($cells[$commodityIdx]) ? trim($cells[$commodityIdx]) : '';
                    $wholesale = isset($cells[$wholesaleIdx]) ? trim($cells[$wholesaleIdx]) : '';
                    $retail = isset($cells[$retailIdx]) ? trim($cells[$retailIdx]) : '';
                    $county = isset($cells[$countyIdx]) ? trim($cells[$countyIdx]) : '';
                    $date = isset($cells[$dateIdx]) ? trim($cells[$dateIdx]) : '';
                    
                    // Check if this is a poultry product
                    // Normalize commodity name: lowercase, trim, remove extra spaces
                    $commodityNormalized = strtolower(trim(preg_replace('/\s+/', ' ', $commodity)));
                    $productName = null;
                    
                    // Sort keywords by length (longest first) for better matching
                    $sortedProducts = $poultryProducts;
                    uksort($sortedProducts, function($a, $b) {
                        return strlen($b) - strlen($a);
                    });
                    
                    // Try to match commodity name to product keywords
                    foreach ($sortedProducts as $keyword => $standardName) {
                        $keywordNormalized = strtolower(trim($keyword));
                        
                        // Exact match
                        if ($commodityNormalized === $keywordNormalized) {
                            $productName = $standardName;
                            break;
                        }
                        
                        // Check if keyword is contained in commodity (e.g., "meat indiginous chicken" contains "indiginous")
                        if (stripos($commodityNormalized, $keywordNormalized) !== false) {
                            $productName = $standardName;
                            break;
                        }
                        
                        // Check if commodity is contained in keyword (e.g., "duck" matches "duck meat")
                        if (stripos($keywordNormalized, $commodityNormalized) !== false) {
                            $productName = $standardName;
                            break;
                        }
                    }
                    
                    // If still no match, try fuzzy matching for known products
                    if (!$productName) {
                        // Check for "Meat Indiginous Chicken" (note the spelling)
                        if (stripos($commodityNormalized, 'indiginous') !== false && 
                            stripos($commodityNormalized, 'chicken') !== false) {
                            $productName = 'Meat indiginous chicken';
                        }
                        // Check for "Duck"
                        elseif (stripos($commodityNormalized, 'duck') !== false) {
                            $productName = 'Duck';
                        }
                    }
                    
                    if (!$productName) {
                        continue; // Skip non-poultry products
                    }
                    
                    // Extract price from wholesale or retail (prefer retail, fallback to wholesale)
                    $priceStr = !empty($retail) && $retail !== '-' ? $retail : (!empty($wholesale) && $wholesale !== '-' ? $wholesale : '');
                    $price = null;
                    $unit = 'per unit';
                    
                    if (!empty($priceStr) && $priceStr !== '-') {
                        // Price format: "60.00/Kg" or "100.00" or "KES 100.00" or "60.00/Kg" or "-"
                        // Extract number and unit
                        if (preg_match('/(\d+(?:\.\d+)?)/', $priceStr, $priceMatch)) {
                            $price = (float)$priceMatch[1];
                            
                            // Extract unit
                            if (preg_match('/\/([A-Za-z]+)/i', $priceStr, $unitMatch)) {
                                $unit = ucfirst(strtolower($unitMatch[1]));
                                // Normalize units
                                if (stripos($unit, 'kg') !== false || stripos($unit, 'kilogram') !== false) {
                                    $unit = 'Kg';
                                } elseif (stripos($unit, 'tray') !== false) {
                                    $unit = 'Tray';
                                } elseif (stripos($unit, 'dozen') !== false) {
                                    $unit = 'Dozen';
                                } elseif (stripos($unit, 'piece') !== false) {
                                    $unit = 'Piece';
                                }
                            } else {
                                // Default unit based on product type
                                if (stripos($productName, 'egg') !== false) {
                                    $unit = 'Tray';
                                } elseif (stripos($productName, 'chicken') !== false || 
                                          stripos($productName, 'broiler') !== false ||
                                          stripos($productName, 'duck') !== false) {
                                    $unit = 'Kg';
                                }
                            }
                        }
                    }
                    
                    // Skip if no valid price found
                    if ($price === null || $price <= 0) {
                        continue;
                    }
                    
                    // Parse date (format: YYYY-MM-DD)
                    $dateReported = date('Y-m-d'); // Default to today
                    if (!empty($date)) {
                        if (preg_match('/(\d{4}-\d{2}-\d{2})/', $date, $dateMatch)) {
                            $dateReported = $dateMatch[1];
                        } elseif (preg_match('/(\d{2}\/\d{2}\/\d{4})/', $date, $dateMatch)) {
                            $dateParts = explode('/', $dateMatch[1]);
                            $dateReported = $dateParts[2] . '-' . $dateParts[1] . '-' . $dateParts[0];
                        }
                    }
                    
                    // Normalize county name
                    if (!empty($county)) {
                        $county = ucwords(strtolower($county));
                        // Fix common variations
                        $county = str_replace('-', ' ', $county);
                        $county = str_replace('Uasin Gishu', 'Uasin Gishu', $county);
                    } else {
                        $county = 'National';
                    }
                    
                    // Validate price (reasonable ranges for poultry products in Kenya)
                    $isValidPrice = false;
                    if ($price && $price > 0) {
                        // Product-specific price validation
                        $productNameLower = strtolower($productName);
                        
                        if (stripos($productNameLower, 'egg') !== false) {
                            // Eggs: typically 200-800 KES per tray
                            $isValidPrice = ($price >= 200 && $price <= 2000);
                        } elseif (stripos($productNameLower, 'chicken') !== false || 
                                  stripos($productNameLower, 'broiler') !== false ||
                                  stripos($productNameLower, 'poultry') !== false) {
                            // Chicken/Broiler: typically 300-800 KES per kg
                            $isValidPrice = ($price >= 200 && $price <= 2000);
                        } elseif (stripos($productNameLower, 'indigenous') !== false || 
                                  stripos($productNameLower, 'kienyeji') !== false) {
                            // Indigenous chicken: typically 400-1000 KES per kg
                            $isValidPrice = ($price >= 300 && $price <= 2500);
                        }                         elseif (stripos($productNameLower, 'duck') !== false) {
                            // Duck: typically 400-1000 KES per kg (wider range for validation)
                            $isValidPrice = ($price >= 200 && $price <= 3000);
                        } elseif (stripos($productNameLower, 'chick') !== false) {
                            // Chicks: typically 50-500 KES per piece
                            $isValidPrice = ($price >= 50 && $price <= 1000);
                        } else {
                            // Default: reasonable range for any poultry product
                            $isValidPrice = ($price >= 50 && $price <= 5000);
                        }
                    }
                    
                    if ($isValidPrice) {
                        $prices[] = [
                            'product_name' => $productName,
                            'county' => $county,
                            'price' => $price,
                            'unit' => $unit,
                            'date_reported' => $dateReported,
                            'market' => $market,
                            'source_type' => !empty($retail) ? 'retail' : 'wholesale'
                        ];
                    }
                }
            }
        }
    }
    
    return $prices;
}

try {
    echo "📡 Fetching KAMIS website...\n";
    echo "Official URL: $kamisBaseUrl\n";
    echo "Market Search URL: $kamisReportsUrl\n\n";
    
    // First, try to fetch the search page to get the form
    $html = null;
    $lastError = null;
    
    try {
        echo "Step 1: Fetching market search page...\n";
        $html = fetchHtml($kamisReportsUrl, false);
        echo "✅ Successfully fetched " . strlen($html) . " bytes of HTML\n\n";
    } catch (Exception $e) {
        $lastError = $e->getMessage();
        echo "❌ Failed to fetch KAMIS website: $lastError\n\n";
        echo "💡 Possible reasons:\n";
        echo "   - KAMIS website is down or not accessible\n";
        echo "   - URL has changed or requires authentication\n";
        echo "   - Network/DNS/firewall issues\n";
        echo "   - SSL certificate problems\n\n";
        echo "✅ Vendor price aggregation is still working as the primary data source.\n";
        echo "💡 You can manually add KAMIS data or update the scraper when website is accessible.\n";
        echo "💡 Official KAMIS URL: https://kamis.kilimo.go.ke/\n\n";
        exit(0);
    }
    
    // Step 2: Search for ALL poultry products with comprehensive data collection
    echo "Step 2: Comprehensive poultry data collection...\n";
    echo "Poultry products to search: " . implode(', ', array_values($poultryProductIds)) . "\n\n";
    
    $allPrices = [];
    
    // Strategy 1: Search each poultry product individually with maximum results per page
    echo "📊 Strategy 1: Searching each product individually (with max results per page)...\n";
    foreach ($poultryProductIds as $productId => $productName) {
        echo "  Searching for: $productName (ID: $productId)...\n";
        
        // Build query for single product with maximum results per page (3000)
        $queryString = 'product[]=' . $productId . '&per_page=3000';
        $searchUrl = $kamisReportsUrl . '?' . $queryString;
        
        // Fetch with maximum results per page (with retry logic)
        $retries = 2;
        $success = false;
        
        for ($attempt = 1; $attempt <= $retries; $attempt++) {
            try {
                $pageHtml = fetchHtml($searchUrl, false, null, 90);
                $pagePrices = parseKamisTable($pageHtml);
                
                if (!empty($pagePrices)) {
                    $allPrices = array_merge($allPrices, $pagePrices);
                    echo "    ✅ Found " . count($pagePrices) . " records (max per page)\n";
                }
                
                // Check for pagination - even with 3000 per page, there might be more
                // KAMIS uses pagination like: /site/market_search/3000? (offset of 3000)
                if (preg_match_all('/market_search\/(\d+)\?/', $pageHtml, $paginationMatches)) {
                    $offsets = array_map('intval', $paginationMatches[1]);
                    $maxOffset = !empty($offsets) ? max($offsets) : 0;
                    
                    // If max offset is greater than 3000, there are more pages
                    if ($maxOffset >= 3000) {
                        echo "    📄 Detected pagination (max offset: $maxOffset), fetching additional pages...\n";
                        
                        $perPage = 3000; // Use maximum per page
                        $maxPages = min(10, ceil($maxOffset / $perPage) + 2); // Fetch up to 10 more pages
                        
                        for ($page = 1; $page < $maxPages; $page++) {
                            $offset = $page * $perPage;
                            $paginatedUrl = $kamisReportsUrl . '/' . $offset . '?' . $queryString;
                            
                            $pageRetries = 2;
                            $pageSuccess = false;
                            
                            for ($pageAttempt = 1; $pageAttempt <= $pageRetries; $pageAttempt++) {
                                try {
                                    $paginatedHtml = fetchHtml($paginatedUrl, false, null, 90);
                                    $paginatedPrices = parseKamisTable($paginatedHtml);
                                    
                                    if (empty($paginatedPrices)) {
                                        $pageSuccess = true;
                                        break;
                                    }
                                    
                                    $allPrices = array_merge($allPrices, $paginatedPrices);
                                    echo "      ✅ Offset $offset: Found " . count($paginatedPrices) . " records\n";
                                    
                                    // If we got fewer results, might be last page
                                    if (count($paginatedPrices) < 100) {
                                        $pageSuccess = true;
                                        break;
                                    }
                                    
                                    $pageSuccess = true;
                                    usleep(500000); // 0.5 second delay
                                    break;
                                    
                                } catch (Exception $e) {
                                    if ($pageAttempt < $pageRetries) {
                                        echo "      ⚠️  Retry $pageAttempt/$pageRetries for offset $offset...\n";
                                        sleep(1);
                                    } else {
                                        echo "      ⚠️  Failed to fetch offset $offset: " . $e->getMessage() . "\n";
                                        break;
                                    }
                                }
                            }
                            
                            if (!$pageSuccess) {
                                break; // Stop pagination if we can't fetch
                            }
                        }
                    }
                }
                
                $success = true;
                break; // Success, exit retry loop
                
            } catch (Exception $e) {
                if ($attempt < $retries) {
                    echo "    ⚠️  Retry $attempt/$retries for $productName...\n";
                    sleep(2);
                } else {
                    echo "    ⚠️  Error searching for $productName after $retries attempts: " . $e->getMessage() . "\n";
                }
            }
        }
        
        if ($success) {
            usleep(500000); // Delay between products only on success
        }
    }
    
    // Strategy 2: Search with date range (last 4 years) with maximum results per page
    echo "\n📅 Strategy 2: Searching with date ranges for historical data (last 4 years)...\n";
    $currentYear = (int)date('Y');
    $yearsToFetch = 4; // Last 4 years
    
    // Search for each year with maximum results per page
    for ($year = $currentYear; $year >= $currentYear - $yearsToFetch + 1; $year--) {
        echo "  Searching for year: $year (with max results per page)...\n";
        
        // Build query with date range (year start to year end) and max results
        $startDate = "$year-01-01";
        $endDate = "$year-12-31";
        
        // Search all poultry products for this year with maximum per page
        $queryParams = [];
        foreach (array_keys($poultryProductIds) as $productId) {
            $queryParams[] = 'product[]=' . $productId;
        }
        $queryParams[] = 'start=' . $startDate;
        $queryParams[] = 'end=' . $endDate;
        $queryParams[] = 'per_page=3000'; // Maximum results per page
        $queryString = implode('&', $queryParams);
        $searchUrl = $kamisReportsUrl . '?' . $queryString;
        
        $retries = 3;
        $success = false;
        
        for ($attempt = 1; $attempt <= $retries; $attempt++) {
            try {
                // Use longer timeout for year searches (120 seconds)
                $yearHtml = fetchHtml($searchUrl, false, null, 120);
                $yearPrices = parseKamisTable($yearHtml);
                
                if (!empty($yearPrices)) {
                    $allPrices = array_merge($allPrices, $yearPrices);
                    echo "    ✅ Year $year: Found " . count($yearPrices) . " records\n";
                }
                
                // Check for pagination (even with 3000 per page, might be more)
                if (preg_match_all('/market_search\/(\d+)\?/', $yearHtml, $paginationMatches)) {
                    $offsets = array_map('intval', $paginationMatches[1]);
                    $maxOffset = !empty($offsets) ? max($offsets) : 0;
                    
                    if ($maxOffset >= 3000) {
                        echo "    📄 Year $year: Fetching additional pages (max offset: $maxOffset)...\n";
                        $perPage = 3000;
                        $maxPages = min(5, ceil($maxOffset / $perPage) + 1);
                        
                        for ($page = 1; $page < $maxPages; $page++) {
                            $offset = $page * $perPage;
                            $paginatedUrl = $kamisReportsUrl . '/' . $offset . '?' . $queryString;
                            
                            $pageRetries = 2;
                            $pageSuccess = false;
                            
                            for ($pageAttempt = 1; $pageAttempt <= $pageRetries; $pageAttempt++) {
                                try {
                                    $paginatedHtml = fetchHtml($paginatedUrl, false, null, 120);
                                    $paginatedPrices = parseKamisTable($paginatedHtml);
                                    
                                    if (empty($paginatedPrices)) {
                                        $pageSuccess = true;
                                        break;
                                    }
                                    
                                    $allPrices = array_merge($allPrices, $paginatedPrices);
                                    echo "      ✅ Year $year, Offset $offset: Found " . count($paginatedPrices) . " records\n";
                                    
                                    if (count($paginatedPrices) < 100) {
                                        $pageSuccess = true;
                                        break;
                                    }
                                    
                                    $pageSuccess = true;
                                    usleep(500000);
                                    break;
                                    
                                } catch (Exception $e) {
                                    if ($pageAttempt < $pageRetries) {
                                        echo "      ⚠️  Retry $pageAttempt/$pageRetries for offset $offset...\n";
                                        sleep(2); // Wait before retry
                                    } else {
                                        echo "      ⚠️  Failed to fetch offset $offset after $pageRetries attempts: " . $e->getMessage() . "\n";
                                        break;
                                    }
                                }
                            }
                            
                            if (!$pageSuccess) {
                                break; // Stop pagination if we can't fetch
                            }
                        }
                    }
                }
                
                $success = true;
                break; // Success, exit retry loop
                
            } catch (Exception $e) {
                if ($attempt < $retries) {
                    echo "    ⚠️  Retry $attempt/$retries for year $year...\n";
                    sleep(3); // Wait before retry
                } else {
                    echo "    ❌ Error searching year $year after $retries attempts: " . $e->getMessage() . "\n";
                    echo "    💡 Continuing with other years...\n";
                }
            }
        }
        
        if ($success) {
            usleep(500000); // Delay between years only on success
        }
    }
    
    // Strategy 3: Search all products together with maximum results per page
    echo "\n📦 Strategy 3: Searching all poultry products together (with max results per page)...\n";
    $queryParams = [];
    foreach (array_keys($poultryProductIds) as $productId) {
        $queryParams[] = 'product[]=' . $productId;
    }
    $queryParams[] = 'per_page=3000'; // Maximum results per page
    $queryString = implode('&', $queryParams);
    $searchUrl = $kamisReportsUrl . '?' . $queryString;
    
    try {
        $allProductsHtml = fetchHtml($searchUrl, false);
        $allProductsPrices = parseKamisTable($allProductsHtml);
        
        if (!empty($allProductsPrices)) {
            $allPrices = array_merge($allPrices, $allProductsPrices);
            echo "  ✅ Combined search: Found " . count($allProductsPrices) . " records\n";
        }
        
        // Fetch paginated results if needed
        if (preg_match_all('/market_search\/(\d+)\?/', $allProductsHtml, $paginationMatches)) {
            $offsets = array_map('intval', $paginationMatches[1]);
            $maxOffset = !empty($offsets) ? max($offsets) : 0;
            
            if ($maxOffset >= 3000) {
                echo "  📄 Fetching additional paginated results (max offset: $maxOffset)...\n";
                $perPage = 3000;
                $maxPages = min(10, ceil($maxOffset / $perPage) + 2); // Fetch up to 10 more pages
                
                for ($page = 1; $page < $maxPages; $page++) {
                    $offset = $page * $perPage;
                    $paginatedUrl = $kamisReportsUrl . '/' . $offset . '?' . $queryString;
                    
                    try {
                        $paginatedHtml = fetchHtml($paginatedUrl, false);
                        $paginatedPrices = parseKamisTable($paginatedHtml);
                        
                        if (empty($paginatedPrices)) {
                            break;
                        }
                        
                        $allPrices = array_merge($allPrices, $paginatedPrices);
                        
                        if ($page % 2 == 0 || $page == 1) {
                            echo "    📄 Offset $offset: Found " . count($paginatedPrices) . " records (total: " . count($allPrices) . ")\n";
                        }
                        
                        if (count($paginatedPrices) < 100) {
                            break;
                        }
                        
                        usleep(500000);
                        
                    } catch (Exception $e) {
                        break;
                    }
                }
            }
        }
        
    } catch (Exception $e) {
        echo "  ⚠️  Error in combined search: " . $e->getMessage() . "\n";
    }
    
    // Remove duplicates (same product, county, date, price)
    echo "\n🔍 Removing duplicates...\n";
    $uniquePrices = [];
    $seen = [];
    
    foreach ($allPrices as $price) {
        $key = $price['product_name'] . '|' . $price['county'] . '|' . $price['date_reported'] . '|' . $price['price'] . '|' . $price['unit'];
        
        if (!isset($seen[$key])) {
            $seen[$key] = true;
            $uniquePrices[] = $price;
        }
    }
    
    $prices = $uniquePrices;
    
    echo "✅ Total unique poultry price records: " . count($prices) . " (from " . count($allPrices) . " total records, " . (count($allPrices) - count($prices)) . " duplicates removed)\n\n";
    
    if (empty($prices)) {
        echo "⚠️  No price data found in HTML.\n";
        echo "💡 KAMIS website structure may have changed, or data format is different.\n";
        echo "💡 You may need to manually inspect the HTML structure and update the parser.\n\n";
        
        // Save HTML for manual inspection
        $htmlFile = __DIR__ . '/kamis_sample.html';
        file_put_contents($htmlFile, $html);
        echo "💾 Saved HTML to: $htmlFile (for manual inspection)\n";
        exit(0);
    }
    
    // Show statistics by product, year, and county
    echo "📊 Data Statistics:\n";
    
    $byProduct = [];
    $byYear = [];
    $byCounty = [];
    
    foreach ($prices as $price) {
        $product = $price['product_name'];
        $year = substr($price['date_reported'], 0, 4);
        $county = $price['county'];
        
        $byProduct[$product] = ($byProduct[$product] ?? 0) + 1;
        $byYear[$year] = ($byYear[$year] ?? 0) + 1;
        $byCounty[$county] = ($byCounty[$county] ?? 0) + 1;
    }
    
    echo "  📦 By Product:\n";
    arsort($byProduct);
    foreach ($byProduct as $product => $count) {
        echo "    - $product: $count records\n";
    }
    
    echo "  📅 By Year:\n";
    ksort($byYear);
    foreach ($byYear as $year => $count) {
        echo "    - $year: $count records\n";
    }
    
    echo "  🗺️  Top 10 Counties:\n";
    arsort($byCounty);
    $topCounties = array_slice($byCounty, 0, 10, true);
    foreach ($topCounties as $county => $count) {
        echo "    - $county: $count records\n";
    }
    echo "\n";
    
    // Show sample data
    echo "📋 Sample price data:\n";
    foreach (array_slice($prices, 0, 5) as $price) {
        echo "  - {$price['product_name']} in {$price['county']}: KES " . number_format($price['price'], 2) . " per {$price['unit']} ({$price['date_reported']})\n";
    }
    echo "\n";
    
    // Step 3: Save to database
    echo "💾 Saving to database...\n";
    
    $inserted = 0;
    $updated = 0;
    $skipped = 0;
    
    $stmt = $pdo->prepare("
        INSERT INTO market_prices (product_name, county, price, unit, date_reported, source)
        VALUES (?, ?, ?, ?, ?, 'KAMIS')
        ON DUPLICATE KEY UPDATE 
            price = VALUES(price),
            updated_at = CURRENT_TIMESTAMP
    ");
    
    // Insert in batches for better performance
    $batchSize = 500;
    $batches = array_chunk($prices, $batchSize);
    $totalBatches = count($batches);
    
    foreach ($batches as $batchIndex => $batch) {
        $pdo->beginTransaction();
        
        try {
            $batchInserted = 0;
            $batchUpdated = 0;
            $batchSkipped = 0;
            
            foreach ($batch as $priceData) {
                try {
                    $stmt->execute([
                        $priceData['product_name'],
                        $priceData['county'],
                        $priceData['price'],
                        $priceData['unit'],
                        $priceData['date_reported']
                    ]);
                    
                    $rowsAffected = $stmt->rowCount();
                    if ($rowsAffected > 0) {
                        // Try to determine if it was insert or update
                        // Note: lastInsertId() only works for inserts, not updates
                        // We'll assume inserts if rowCount is 1 and no error
                        $lastId = $pdo->lastInsertId();
                        if ($lastId && $lastId > 0) {
                            $batchInserted++;
                        } else {
                            // Likely an update (ON DUPLICATE KEY UPDATE)
                            $batchUpdated++;
                        }
                    }
                } catch (PDOException $e) {
                    // Check if it's a duplicate key error (handled by ON DUPLICATE KEY UPDATE)
                    if (strpos($e->getMessage(), 'Duplicate entry') === false && 
                        strpos($e->getMessage(), 'UNIQUE constraint') === false) {
                        error_log("Error inserting KAMIS price: " . $e->getMessage());
                    }
                    $batchSkipped++;
                }
            }
            
            $pdo->commit();
            $inserted += $batchInserted;
            $updated += $batchUpdated;
            $skipped += $batchSkipped;
            
            // Progress indicator
            if (($batchIndex + 1) % 5 == 0 || ($batchIndex + 1) == $totalBatches) {
                echo "  💾 Batch " . ($batchIndex + 1) . "/$totalBatches: " . count($batch) . " records processed\n";
            }
            
        } catch (PDOException $e) {
            $pdo->rollBack();
            error_log("Batch insert error: " . $e->getMessage());
            echo "  ⚠️  Batch " . ($batchIndex + 1) . " failed: " . $e->getMessage() . "\n";
            $skipped += count($batch);
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
    
    echo "\n✅ KAMIS scraping completed!\n";
    echo "📊 Summary:\n";
    echo "  - Records found: " . count($prices) . "\n";
    echo "  - Records inserted: $inserted\n";
    echo "  - Records updated: $updated\n";
    echo "  - Records skipped: $skipped\n";
    echo "  - Total records in database: " . $pdo->query("SELECT COUNT(*) FROM market_prices")->fetchColumn() . "\n";
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    error_log("KAMIS scraping error: " . $e->getMessage());
    exit(1);
}

