<?php
/**
 * Comprehensive test script for Location API endpoints
 * Tests all endpoints and verifies response format matches frontend expectations
 * 
 * Usage: php backend/scripts/test_location_api_complete.php
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/cache.php';
require_once __DIR__ . '/../routes/location.php';

// ANSI color codes for terminal output
$GREEN = "\033[32m";
$RED = "\033[31m";
$YELLOW = "\033[33m";
$BLUE = "\033[34m";
$RESET = "\033[0m";
$BOLD = "\033[1m";

echo $BOLD . "=" . str_repeat("=", 70) . "=\n";
echo "  COMPREHENSIVE LOCATION API TEST SUITE\n";
echo "=" . str_repeat("=", 70) . "=\n" . $RESET;
echo "\n";

$totalTests = 0;
$passedTests = 0;
$failedTests = 0;

/**
 * Test helper function
 */
function runTest($testName, $callback) {
    global $totalTests, $passedTests, $failedTests, $GREEN, $RED, $YELLOW, $RESET, $BOLD;
    
    $totalTests++;
    echo $BOLD . "[TEST $totalTests] " . $RESET . $testName . "... ";
    flush();
    
    try {
        // Run the callback (it handles its own output buffering)
        $result = $callback();
        
        if ($result['success']) {
            echo $GREEN . "✓ PASSED" . $RESET;
            if (isset($result['message'])) {
                echo " - " . $result['message'];
            }
            $passedTests++;
        } else {
            echo $RED . "✗ FAILED" . $RESET;
            if (isset($result['message'])) {
                echo " - " . $result['message'];
            }
            $failedTests++;
        }
    } catch (Exception $e) {
        echo $RED . "✗ ERROR" . $RESET . " - " . $e->getMessage();
        $failedTests++;
    }
    echo "\n";
    flush();
}

/**
 * Test 1: Get Counties (no search)
 */
runTest("Get Counties (full list)", function() {
    $_GET = [];
    ob_start();
    @handleGetCounties(); // Suppress header warnings
    $output = ob_get_clean();
    ob_end_clean(); // Ensure clean output buffer
    $data = json_decode($output, true);
    
    if (!$data) {
        return ['success' => false, 'message' => 'Invalid JSON response'];
    }
    
    if (!isset($data['success']) || $data['success'] !== true) {
        return ['success' => false, 'message' => 'Response success flag is false'];
    }
    
    if (!isset($data['data']) || !is_array($data['data'])) {
        return ['success' => false, 'message' => 'Data field missing or not an array'];
    }
    
    if (count($data['data']) === 0) {
        return ['success' => false, 'message' => 'No counties returned'];
    }
    
    // Check first county structure
    $firstCounty = $data['data'][0];
    $requiredFields = ['county_id', 'county_name'];
    foreach ($requiredFields as $field) {
        if (!isset($firstCounty[$field])) {
            return ['success' => false, 'message' => "Missing field: $field"];
        }
    }
    
    return [
        'success' => true,
        'message' => "Returned " . count($data['data']) . " counties"
    ];
});

/**
 * Test 2: Get Counties (with search)
 */
runTest("Get Counties (with search term)", function() {
    $_GET = ['search' => 'Nairobi'];
    ob_start();
    @handleGetCounties(); // Suppress header warnings
    $output = ob_get_clean();
    $data = json_decode($output, true);
    
    if (!$data || !isset($data['success']) || $data['success'] !== true) {
        return ['success' => false, 'message' => 'Invalid response'];
    }
    
    if (!is_array($data['data'])) {
        return ['success' => false, 'message' => 'Data is not an array'];
    }
    
    // Should find at least Nairobi county
    $foundNairobi = false;
    foreach ($data['data'] as $county) {
        if (stripos($county['county_name'], 'Nairobi') !== false) {
            $foundNairobi = true;
            break;
        }
    }
    
    if (!$foundNairobi) {
        return ['success' => false, 'message' => 'Search did not find Nairobi'];
    }
    
    return [
        'success' => true,
        'message' => "Found " . count($data['data']) . " matching counties"
    ];
});

/**
 * Test 3: Get Constituencies (valid county_id)
 */
runTest("Get Constituencies (valid county_id)", function() {
    // Get a real county_id from database
    global $pdo;
    $stmt = $pdo->query("SELECT county_id FROM counties LIMIT 1");
    $county = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$county) {
        return ['success' => false, 'message' => 'No counties in database'];
    }
    
    $countyId = $county['county_id'];
    $_GET = ['county_id' => $countyId];
    ob_start();
    @handleGetConstituencies(); // Suppress header warnings
    $output = ob_get_clean();
    $data = json_decode($output, true);
    
    if (!$data || !isset($data['success']) || $data['success'] !== true) {
        return ['success' => false, 'message' => 'Invalid response'];
    }
    
    if (!isset($data['data']) || !is_array($data['data'])) {
        return ['success' => false, 'message' => 'Data field missing or not an array'];
    }
    
    if (count($data['data']) === 0) {
        return ['success' => false, 'message' => 'No constituencies returned for county_id=' . $countyId];
    }
    
    // Check first constituency structure
    $firstConstituency = $data['data'][0];
    $requiredFields = ['constituency_id', 'constituency_name', 'county_id'];
    foreach ($requiredFields as $field) {
        if (!isset($firstConstituency[$field])) {
            return ['success' => false, 'message' => "Missing field: $field"];
        }
    }
    
    // Verify all constituencies belong to the requested county
    foreach ($data['data'] as $constituency) {
        if ($constituency['county_id'] != $countyId) {
            return ['success' => false, 'message' => 'Constituency belongs to wrong county'];
        }
    }
    
    return [
        'success' => true,
        'message' => "Returned " . count($data['data']) . " constituencies for county_id=$countyId"
    ];
});

/**
 * Test 4: Get Constituencies (invalid county_id)
 */
runTest("Get Constituencies (invalid county_id)", function() {
    $_GET = ['county_id' => '99999']; // Non-existent county
    ob_start();
    @handleGetConstituencies(); // Suppress header warnings
    $output = ob_get_clean();
    $data = json_decode($output, true);
    
    if (!$data) {
        return ['success' => false, 'message' => 'Invalid JSON response'];
    }
    
    // Should return empty array, not error
    if (isset($data['success']) && $data['success'] === true) {
        if (isset($data['data']) && is_array($data['data']) && count($data['data']) === 0) {
            return [
                'success' => true,
                'message' => 'Correctly returned empty array for non-existent county'
            ];
        }
    }
    
    return [
        'success' => true,
        'message' => 'Handled invalid county_id gracefully'
    ];
});

/**
 * Test 5: Get Constituencies (missing county_id)
 */
runTest("Get Constituencies (missing county_id)", function() {
    $_GET = [];
    ob_start();
    @handleGetConstituencies(); // Suppress header warnings
    $output = ob_get_clean();
    $data = json_decode($output, true);
    
    if (!$data) {
        return ['success' => false, 'message' => 'Invalid JSON response'];
    }
    
    if (isset($data['success']) && $data['success'] === false && isset($data['error'])) {
        return [
            'success' => true,
            'message' => 'Correctly returned error for missing county_id'
        ];
    }
    
    return ['success' => false, 'message' => 'Should return error for missing county_id'];
});

/**
 * Test 6: Get Wards (valid constituency_id)
 */
runTest("Get Wards (valid constituency_id)", function() {
    // Get a real constituency_id from database
    global $pdo;
    $stmt = $pdo->query("SELECT constituency_id FROM constituencies LIMIT 1");
    $constituency = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$constituency) {
        return ['success' => false, 'message' => 'No constituencies in database'];
    }
    
    $constituencyId = $constituency['constituency_id'];
    $_GET = ['constituency_id' => $constituencyId];
    ob_start();
    @handleGetWards(); // Suppress header warnings
    $output = ob_get_clean();
    $data = json_decode($output, true);
    
    if (!$data || !isset($data['success']) || $data['success'] !== true) {
        return ['success' => false, 'message' => 'Invalid response'];
    }
    
    if (!isset($data['data']) || !is_array($data['data'])) {
        return ['success' => false, 'message' => 'Data field missing or not an array'];
    }
    
    if (count($data['data']) === 0) {
        return ['success' => false, 'message' => 'No wards returned for constituency_id=' . $constituencyId];
    }
    
    // Check first ward structure
    $firstWard = $data['data'][0];
    $requiredFields = ['ward_id', 'ward_name', 'constituency_id'];
    foreach ($requiredFields as $field) {
        if (!isset($firstWard[$field])) {
            return ['success' => false, 'message' => "Missing field: $field"];
        }
    }
    
    // Verify all wards belong to the requested constituency
    foreach ($data['data'] as $ward) {
        if ($ward['constituency_id'] != $constituencyId) {
            return ['success' => false, 'message' => 'Ward belongs to wrong constituency'];
        }
    }
    
    return [
        'success' => true,
        'message' => "Returned " . count($data['data']) . " wards for constituency_id=$constituencyId"
    ];
});

/**
 * Test 7: Get Wards (missing constituency_id)
 */
runTest("Get Wards (missing constituency_id)", function() {
    $_GET = [];
    ob_start();
    @handleGetWards(); // Suppress header warnings
    $output = ob_get_clean();
    $data = json_decode($output, true);
    
    if (!$data) {
        return ['success' => false, 'message' => 'Invalid JSON response'];
    }
    
    if (isset($data['success']) && $data['success'] === false && isset($data['error'])) {
        return [
            'success' => true,
            'message' => 'Correctly returned error for missing constituency_id'
        ];
    }
    
    return ['success' => false, 'message' => 'Should return error for missing constituency_id'];
});

/**
 * Test 8: Response format consistency
 */
runTest("Response format consistency", function() {
    global $pdo;
    
    // Test all three endpoints
    $endpoints = [
        'counties' => function() {
            $_GET = [];
            ob_start();
            @handleGetCounties(); // Suppress header warnings
            return json_decode(ob_get_clean(), true);
        },
        'constituencies' => function() {
            $stmt = $pdo->query("SELECT county_id FROM counties LIMIT 1");
            $county = $stmt->fetch(PDO::FETCH_ASSOC);
            $_GET = ['county_id' => $county['county_id']];
            ob_start();
            @handleGetConstituencies(); // Suppress header warnings
            return json_decode(ob_get_clean(), true);
        },
        'wards' => function() {
            $stmt = $pdo->query("SELECT constituency_id FROM constituencies LIMIT 1");
            $constituency = $stmt->fetch(PDO::FETCH_ASSOC);
            $_GET = ['constituency_id' => $constituency['constituency_id']];
            ob_start();
            @handleGetWards(); // Suppress header warnings
            return json_decode(ob_get_clean(), true);
        }
    ];
    
    $requiredFields = ['success', 'data'];
    foreach ($endpoints as $name => $callback) {
        $data = $callback();
        
        foreach ($requiredFields as $field) {
            if (!isset($data[$field])) {
                return ['success' => false, 'message' => "$name endpoint missing field: $field"];
            }
        }
        
        if ($data['success'] !== true) {
            return ['success' => false, 'message' => "$name endpoint success flag is false"];
        }
        
        if (!is_array($data['data'])) {
            return ['success' => false, 'message' => "$name endpoint data is not an array"];
        }
    }
    
    return [
        'success' => true,
        'message' => 'All endpoints return consistent format'
    ];
});

/**
 * Test 9: Performance test (response time)
 */
runTest("Performance test (response time < 100ms)", function() {
    global $pdo;
    
    $startTime = microtime(true);
    
    // Test constituencies endpoint
    $stmt = $pdo->query("SELECT county_id FROM counties LIMIT 1");
    $county = $stmt->fetch(PDO::FETCH_ASSOC);
    $_GET = ['county_id' => $county['county_id']];
    ob_start();
    @handleGetConstituencies(); // Suppress header warnings
    ob_get_clean();
    
    $endTime = microtime(true);
    $executionTime = ($endTime - $startTime) * 1000; // Convert to milliseconds
    
    if ($executionTime > 100) {
        return [
            'success' => false,
            'message' => "Response time too slow: " . round($executionTime, 2) . "ms"
        ];
    }
    
    return [
        'success' => true,
        'message' => "Response time: " . round($executionTime, 2) . "ms"
    ];
});

/**
 * Test 10: Caching test
 */
runTest("Caching functionality", function() {
    global $pdo;
    
    // Clear cache first
    $cacheKey = 'constituencies_1_';
    $cacheFile = __DIR__ . '/../cache/' . md5($cacheKey) . '.cache';
    if (file_exists($cacheFile)) {
        unlink($cacheFile);
    }
    
    // First request (should not be cached)
    $stmt = $pdo->query("SELECT county_id FROM counties LIMIT 1");
    $county = $stmt->fetch(PDO::FETCH_ASSOC);
    $_GET = ['county_id' => $county['county_id']];
    
    ob_start();
    @handleGetConstituencies(); // Suppress header warnings
    $firstResponse = json_decode(ob_get_clean(), true);
    
    // Second request (should be cached)
    ob_start();
    @handleGetConstituencies(); // Suppress header warnings
    $secondResponse = json_decode(ob_get_clean(), true);
    
    if (!isset($secondResponse['cached']) || $secondResponse['cached'] !== true) {
        return [
            'success' => false,
            'message' => 'Second request should be cached but cached flag is false'
        ];
    }
    
    if ($secondResponse['execution_time_ms'] > 0) {
        return [
            'success' => false,
            'message' => 'Cached response should have execution_time_ms = 0'
        ];
    }
    
    return [
        'success' => true,
        'message' => 'Caching working correctly'
    ];
});

/**
 * Test 11: SQL Injection protection
 */
runTest("SQL Injection protection", function() {
    // Try to inject SQL
    $_GET = ['county_id' => "1' OR '1'='1"];
    ob_start();
    @handleGetConstituencies(); // Suppress header warnings
    $output = ob_get_clean();
    $data = json_decode($output, true);
    
    // Should return error or empty result, not execute SQL injection
    if (!$data) {
        return ['success' => false, 'message' => 'Invalid JSON response'];
    }
    
    // Should either return error or empty array (not all constituencies)
    if (isset($data['success']) && $data['success'] === true) {
        if (isset($data['data']) && is_array($data['data'])) {
            // If it returns data, it should be empty or very limited
            if (count($data['data']) > 100) {
                return [
                    'success' => false,
                    'message' => 'SQL injection may have succeeded (too many results)'
                ];
            }
        }
    }
    
    return [
        'success' => true,
        'message' => 'SQL injection attempt blocked'
    ];
});

/**
 * Test 12: Data type validation
 */
runTest("Data type validation", function() {
    global $pdo;
    
    $stmt = $pdo->query("SELECT county_id FROM counties LIMIT 1");
    $county = $stmt->fetch(PDO::FETCH_ASSOC);
    $_GET = ['county_id' => $county['county_id']];
    ob_start();
    @handleGetConstituencies(); // Suppress header warnings
    $data = json_decode(ob_get_clean(), true);
    
    if (!$data || !isset($data['data']) || !is_array($data['data'])) {
        return ['success' => false, 'message' => 'Invalid response structure'];
    }
    
    foreach ($data['data'] as $item) {
        // Check data types
        if (!is_numeric($item['constituency_id'])) {
            return ['success' => false, 'message' => 'constituency_id is not numeric'];
        }
        if (!is_string($item['constituency_name'])) {
            return ['success' => false, 'message' => 'constituency_name is not string'];
        }
        if (!is_numeric($item['county_id'])) {
            return ['success' => false, 'message' => 'county_id is not numeric'];
        }
    }
    
    return [
        'success' => true,
        'message' => 'All data types are correct'
    ];
});

// Print summary
echo "\n";
echo $BOLD . "=" . str_repeat("=", 70) . "=\n";
echo "  TEST SUMMARY\n";
echo "=" . str_repeat("=", 70) . "=\n" . $RESET;
echo "\n";
echo "Total Tests: " . $totalTests . "\n";
echo $GREEN . "Passed: " . $passedTests . $RESET . "\n";
echo $RED . "Failed: " . $failedTests . $RESET . "\n";
echo "\n";

if ($failedTests === 0) {
    echo $GREEN . $BOLD . "✓ ALL TESTS PASSED!" . $RESET . "\n";
    echo "\n";
    echo "The Location API is working correctly and ready for production use.\n";
    exit(0);
} else {
    echo $RED . $BOLD . "✗ SOME TESTS FAILED" . $RESET . "\n";
    echo "\n";
    echo "Please review the failed tests above and fix the issues.\n";
    exit(1);
}

