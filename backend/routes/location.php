<?php
/**
 * Location API endpoints for Kenya counties, constituencies, and wards
 * Note: database.php is already included in index.php, so we use the global $pdo
 * Uses caching to improve performance and reduce database load
 */

require_once __DIR__ . '/../utils/cache.php';
require_once __DIR__ . '/../utils/security.php';

function handleGetCounties() {
    global $pdo;
    
    try {
        // Sanitize and validate search input
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        
        // Limit search length to prevent abuse
        if (strlen($search) > 255) {
            $search = substr($search, 0, 255);
        }
        
        // Create cache key based on search term (after sanitization)
        $cacheKey = 'counties_' . md5($search);
        
        // Try to get from cache first (if no search term, cache is very effective)
        if (empty($search)) {
            $cached = SimpleCache::get($cacheKey);
            if ($cached !== null) {
                http_response_code(200);
                echo json_encode([
                    'success' => true, 
                    'data' => $cached,
                    'count' => count($cached),
                    'execution_time_ms' => 0,
                    'cached' => true
                ]);
                exit;
            }
        }
        
        // Optimized query - counties table should be small, but still use indexed column for ordering
        // Only select what we need: id and name (county_code is optional)
        $query = "SELECT county_id, county_name, county_code 
                  FROM counties";
        $params = [];
        
        if (!empty($search)) {
            // Sanitize search term - remove any SQL wildcards that could cause issues
            // Allow only alphanumeric, spaces, and common punctuation
            $searchTerm = preg_replace('/[^a-zA-Z0-9\s\-.,]/', '', $search);
            $searchTerm = "%" . $searchTerm . "%";
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }
        
        // Order by indexed column for faster sorting
        $query .= " ORDER BY county_name ASC LIMIT 50";
        
        $startTime = microtime(true);
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $counties = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $executionTime = round((microtime(true) - $startTime) * 1000, 2);
        
        // Cache the results for 1 hour (counties don't change often)
        // Only cache if no search term (full list)
        if (empty($search)) {
            SimpleCache::set($cacheKey, $counties, 3600); // 1 hour cache
        }
        
        // Log slow queries (over 50ms is considered slow for counties)
        if ($executionTime > 50 && function_exists('error_log')) {
            error_log("Slow counties query: {$executionTime}ms");
        }
        
        http_response_code(200);
        echo json_encode([
            'success' => true, 
            'data' => $counties,
            'count' => count($counties),
            'execution_time_ms' => $executionTime,
            'cached' => false
        ]);
        exit; // Exit immediately after sending response
        
    } catch (PDOException $e) {
        http_response_code(500);
        // Log detailed error for debugging (server-side only)
        error_log("Counties query error: " . $e->getMessage());
        // Return generic error message to client (don't leak database details)
        echo json_encode([
            'success' => false, 
            'error' => 'Failed to fetch counties. Please try again later.'
        ]);
        exit; // Exit immediately after sending error
    }
}

function handleGetConstituencies() {
    global $pdo;
    
    try {
        $countyId = $_GET['county_id'] ?? null;
        // Sanitize and validate search input
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        
        // Limit search length to prevent abuse
        if (strlen($search) > 255) {
            $search = substr($search, 0, 255);
        }
        
        if (!$countyId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'county_id is required']);
            exit;
        }
        
        // Validate county_id is numeric and within reasonable range
        $countyId = filter_var($countyId, FILTER_VALIDATE_INT, [
            'options' => [
                'min_range' => 1,
                'max_range' => 9999
            ]
        ]);
        
        if ($countyId === false) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid county_id']);
            exit;
        }
        
        // Create cache key based on county_id and search term (after sanitization)
        $cacheKey = 'constituencies_' . $countyId . '_' . md5($search);
        
        // Try to get from cache first (if no search term, cache is very effective)
        if (empty($search)) {
            $cached = SimpleCache::get($cacheKey);
            if ($cached !== null) {
                http_response_code(200);
                echo json_encode([
                    'success' => true, 
                    'data' => $cached,
                    'count' => count($cached),
                    'execution_time_ms' => 0,
                    'cached' => true
                ]);
                exit;
            }
        }
        
        // Optimized query - only select what we need: id, name, and county_id
        // Using indexed column (county_id) for fast lookup
        $query = "SELECT constituency_id, constituency_name, county_id 
                  FROM constituencies 
                  WHERE county_id = ?";
        $params = [$countyId];
        
        if (!empty($search)) {
            // Sanitize search term - remove any SQL wildcards that could cause issues
            $searchTerm = preg_replace('/[^a-zA-Z0-9\s\-.,]/', '', $search);
            $searchTerm = "%" . $searchTerm . "%";
            $params[] = $searchTerm;
        }
        
        // Order by indexed column for faster sorting
        $query .= " ORDER BY constituency_name ASC LIMIT 100";
        
        $startTime = microtime(true);
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $constituencies = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $executionTime = round((microtime(true) - $startTime) * 1000, 2);
        
        // Cache the results for 1 hour (constituencies don't change often)
        // Only cache if no search term (full list for county)
        if (empty($search)) {
            SimpleCache::set($cacheKey, $constituencies, 3600); // 1 hour cache
        }
        
        // Log slow queries (over 100ms is considered slow for this simple query)
        if ($executionTime > 100 && function_exists('error_log')) {
            error_log("Slow constituencies query: {$executionTime}ms for county_id={$countyId}");
        }
        
        http_response_code(200);
        echo json_encode([
            'success' => true, 
            'data' => $constituencies,
            'count' => count($constituencies),
            'execution_time_ms' => $executionTime,
            'cached' => false
        ]);
        exit; // Exit immediately after sending response
        
    } catch (PDOException $e) {
        http_response_code(500);
        // Log detailed error for debugging (server-side only)
        error_log("Constituencies query error: " . $e->getMessage());
        // Return generic error message to client (don't leak database details)
        echo json_encode([
            'success' => false, 
            'error' => 'Failed to fetch constituencies. Please try again later.'
        ]);
        exit; // Exit immediately after sending error
    }
}

function handleGetWards() {
    global $pdo;
    
    try {
        $constituencyId = $_GET['constituency_id'] ?? null;
        // Sanitize and validate search input
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        
        // Limit search length to prevent abuse
        if (strlen($search) > 255) {
            $search = substr($search, 0, 255);
        }
        
        if (!$constituencyId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'constituency_id is required']);
            exit;
        }
        
        // Validate constituency_id is numeric and within reasonable range
        $constituencyId = filter_var($constituencyId, FILTER_VALIDATE_INT, [
            'options' => [
                'min_range' => 1,
                'max_range' => 99999
            ]
        ]);
        
        if ($constituencyId === false) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid constituency_id']);
            exit;
        }
        
        // Create cache key based on constituency_id and search term (after sanitization)
        $cacheKey = 'wards_' . $constituencyId . '_' . md5($search);
        
        // Try to get from cache first (if no search term, cache is very effective)
        if (empty($search)) {
            $cached = SimpleCache::get($cacheKey);
            if ($cached !== null) {
                http_response_code(200);
                echo json_encode([
                    'success' => true, 
                    'data' => $cached,
                    'count' => count($cached),
                    'execution_time_ms' => 0,
                    'cached' => true
                ]);
                exit;
            }
        }
        
        // Optimized query - only select what we need: id, name, and constituency_id
        // Using indexed column (constituency_id) for fast lookup
        $query = "SELECT ward_id, ward_name, constituency_id 
                  FROM wards 
                  WHERE constituency_id = ?";
        $params = [$constituencyId];
        
        if (!empty($search)) {
            // Sanitize search term - remove any SQL wildcards that could cause issues
            $searchTerm = preg_replace('/[^a-zA-Z0-9\s\-.,]/', '', $search);
            $searchTerm = "%" . $searchTerm . "%";
            $params[] = $searchTerm;
        }
        
        // Order by indexed column for faster sorting
        $query .= " ORDER BY ward_name ASC LIMIT 100";
        
        $startTime = microtime(true);
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $wards = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $executionTime = round((microtime(true) - $startTime) * 1000, 2);
        
        // Cache the results for 1 hour (wards don't change often)
        // Only cache if no search term (full list for constituency)
        if (empty($search)) {
            SimpleCache::set($cacheKey, $wards, 3600); // 1 hour cache
        }
        
        // Log slow queries (over 100ms is considered slow for this simple query)
        if ($executionTime > 100 && function_exists('error_log')) {
            error_log("Slow wards query: {$executionTime}ms for constituency_id={$constituencyId}");
        }
        
        http_response_code(200);
        echo json_encode([
            'success' => true, 
            'data' => $wards,
            'count' => count($wards),
            'execution_time_ms' => $executionTime,
            'cached' => false
        ]);
        exit; // Exit immediately after sending response
        
    } catch (PDOException $e) {
        http_response_code(500);
        // Log detailed error for debugging (server-side only)
        error_log("Wards query error: " . $e->getMessage());
        // Return generic error message to client (don't leak database details)
        echo json_encode([
            'success' => false, 
            'error' => 'Failed to fetch wards. Please try again later.'
        ]);
        exit; // Exit immediately after sending error
    }
}


/**
 * Get all location data at once (counties, constituencies, wards)
 * This is useful for frontend filtering without multiple API calls
 * Data is cached for optimal performance
 */
function handleGetAllLocations() {
    global $pdo;
    
    try {
        $cacheKey = 'all_locations';
        
        // Try to get from cache first
        $cached = SimpleCache::get($cacheKey);
        if ($cached !== null) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $cached,
                'cached' => true
            ]);
            exit;
        }
        
        $startTime = microtime(true);
        
        // Fetch all counties (using prepared statements even for static queries - best practice)
        $countiesQuery = "SELECT county_id, county_name, county_code FROM counties ORDER BY county_name ASC";
        $countiesStmt = $pdo->prepare($countiesQuery);
        $countiesStmt->execute();
        $counties = $countiesStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Fetch all constituencies (using prepared statements)
        $constituenciesQuery = "SELECT constituency_id, constituency_name, county_id FROM constituencies ORDER BY county_id, constituency_name ASC";
        $constituenciesStmt = $pdo->prepare($constituenciesQuery);
        $constituenciesStmt->execute();
        $constituencies = $constituenciesStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Fetch all wards (using prepared statements)
        $wardsQuery = "SELECT ward_id, ward_name, constituency_id FROM wards ORDER BY constituency_id, ward_name ASC";
        $wardsStmt = $pdo->prepare($wardsQuery);
        $wardsStmt->execute();
        $wards = $wardsStmt->fetchAll(PDO::FETCH_ASSOC);
        
        $executionTime = round((microtime(true) - $startTime) * 1000, 2);
        
        // Organize data for easy frontend filtering
        $data = [
            'counties' => $counties,
            'constituencies' => $constituencies,
            'wards' => $wards
        ];
        
        // Cache for 1 hour (location data rarely changes)
        SimpleCache::set($cacheKey, $data, 3600);
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $data,
            'execution_time_ms' => $executionTime,
            'cached' => false
        ]);
        exit;
        
    } catch (PDOException $e) {
        http_response_code(500);
        // Log detailed error for debugging (server-side only)
        error_log("All locations query error: " . $e->getMessage());
        // Return generic error message to client (don't leak database details)
        echo json_encode([
            'success' => false,
            'error' => 'Failed to fetch location data. Please try again later.'
        ]);
        exit;
    }
}

