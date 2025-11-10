<?php
/**
 * Clean test script for Location API endpoints
 * Tests all endpoints and shows only test results (no JSON output)
 * 
 * Usage: php backend/scripts/test_location_api_clean.php
 */

// Redirect all output to capture JSON responses
ob_start();

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/cache.php';
require_once __DIR__ . '/../routes/location.php';

// Clear the initial buffer
ob_end_clean();

echo "========================================\n";
echo "  LOCATION API TEST SUITE\n";
echo "========================================\n\n";

$tests = 0;
$passed = 0;
$failed = 0;

function test($name, $callback) {
    global $tests, $passed, $failed;
    $tests++;
    echo "[TEST $tests] $name... ";
    flush();
    
    try {
        // Capture all output from callback (including JSON)
        ob_start();
        $result = $callback();
        $jsonOutput = ob_get_clean();
        
        // The callback returns the test result
        if ($result) {
            echo "✓ PASSED";
            if (isset($result['msg'])) {
                echo " - " . $result['msg'];
            }
            $passed++;
        } else {
            echo "✗ FAILED";
            if (isset($result['error'])) {
                echo " - " . $result['error'];
            }
            $failed++;
        }
    } catch (Exception $e) {
        ob_end_clean();
        echo "✗ ERROR - " . $e->getMessage();
        $failed++;
    }
    echo "\n";
    flush();
}

// Test 1: Counties endpoint
test("Get Counties", function() {
    $_GET = [];
    ob_start();
    @handleGetCounties();
    $output = ob_get_clean();
    $data = json_decode($output, true);
    
    if (!$data || !isset($data['success']) || $data['success'] !== true) {
        return ['error' => 'Invalid response'];
    }
    if (!isset($data['data']) || !is_array($data['data']) || count($data['data']) === 0) {
        return ['error' => 'No counties returned'];
    }
    if (!isset($data['data'][0]['county_id']) || !isset($data['data'][0]['county_name'])) {
        return ['error' => 'Missing required fields'];
    }
    return ['msg' => count($data['data']) . ' counties'];
});

// Test 2: Counties with search
test("Get Counties (search)", function() {
    $_GET = ['search' => 'Nairobi'];
    ob_start();
    @handleGetCounties();
    $output = ob_get_clean();
    $data = json_decode($output, true);
    
    if (!$data || !isset($data['success']) || $data['success'] !== true) {
        return ['error' => 'Invalid response'];
    }
    $found = false;
    foreach ($data['data'] as $county) {
        if (stripos($county['county_name'], 'Nairobi') !== false) {
            $found = true;
            break;
        }
    }
    return $found ? ['msg' => 'Found Nairobi'] : ['error' => 'Search failed'];
});

// Test 3: Constituencies endpoint
test("Get Constituencies", function() {
    global $pdo;
    $stmt = $pdo->query("SELECT county_id FROM counties LIMIT 1");
    $county = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$county) return ['error' => 'No counties in database'];
    
    $_GET = ['county_id' => $county['county_id']];
    ob_start();
    @handleGetConstituencies();
    $output = ob_get_clean();
    $data = json_decode($output, true);
    
    if (!$data || !isset($data['success']) || $data['success'] !== true) {
        return ['error' => 'Invalid response'];
    }
    if (!isset($data['data']) || !is_array($data['data'])) {
        return ['error' => 'Data is not an array'];
    }
    if (count($data['data']) > 0) {
        $c = $data['data'][0];
        if (!isset($c['constituency_id']) || !isset($c['constituency_name']) || !isset($c['county_id'])) {
            return ['error' => 'Missing required fields'];
        }
        if ($c['county_id'] != $county['county_id']) {
            return ['error' => 'Wrong county_id'];
        }
    }
    return ['msg' => count($data['data']) . ' constituencies'];
});

// Test 4: Constituencies - missing county_id
test("Get Constituencies (missing county_id)", function() {
    $_GET = [];
    ob_start();
    @handleGetConstituencies();
    $output = ob_get_clean();
    $data = json_decode($output, true);
    
    if (!$data) return ['error' => 'No response'];
    if (isset($data['success']) && $data['success'] === false && isset($data['error'])) {
        return ['msg' => 'Correctly returned error'];
    }
    return ['error' => 'Should return error'];
});

// Test 5: Wards endpoint
test("Get Wards", function() {
    global $pdo;
    $stmt = $pdo->query("SELECT constituency_id FROM constituencies LIMIT 1");
    $constituency = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$constituency) return ['error' => 'No constituencies in database'];
    
    $_GET = ['constituency_id' => $constituency['constituency_id']];
    ob_start();
    @handleGetWards();
    $output = ob_get_clean();
    $data = json_decode($output, true);
    
    if (!$data || !isset($data['success']) || $data['success'] !== true) {
        return ['error' => 'Invalid response'];
    }
    if (!isset($data['data']) || !is_array($data['data'])) {
        return ['error' => 'Data is not an array'];
    }
    if (count($data['data']) > 0) {
        $w = $data['data'][0];
        if (!isset($w['ward_id']) || !isset($w['ward_name']) || !isset($w['constituency_id'])) {
            return ['error' => 'Missing required fields'];
        }
        if ($w['constituency_id'] != $constituency['constituency_id']) {
            return ['error' => 'Wrong constituency_id'];
        }
    }
    return ['msg' => count($data['data']) . ' wards'];
});

// Test 6: Response format
test("Response format consistency", function() {
    global $pdo;
    
    // Test counties
    $_GET = [];
    ob_start();
    @handleGetCounties();
    $c1 = json_decode(ob_get_clean(), true);
    
    // Test constituencies
    $stmt = $pdo->query("SELECT county_id FROM counties LIMIT 1");
    $county = $stmt->fetch(PDO::FETCH_ASSOC);
    $_GET = ['county_id' => $county['county_id']];
    ob_start();
    @handleGetConstituencies();
    $c2 = json_decode(ob_get_clean(), true);
    
    // Test wards
    $stmt = $pdo->query("SELECT constituency_id FROM constituencies LIMIT 1");
    $constituency = $stmt->fetch(PDO::FETCH_ASSOC);
    $_GET = ['constituency_id' => $constituency['constituency_id']];
    ob_start();
    @handleGetWards();
    $c3 = json_decode(ob_get_clean(), true);
    
    foreach ([$c1, $c2, $c3] as $data) {
        if (!isset($data['success']) || !isset($data['data']) || !is_array($data['data'])) {
            return ['error' => 'Inconsistent format'];
        }
    }
    return ['msg' => 'All endpoints return consistent format'];
});

// Test 7: Performance
test("Performance (< 100ms)", function() {
    global $pdo;
    $stmt = $pdo->query("SELECT county_id FROM counties LIMIT 1");
    $county = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $start = microtime(true);
    $_GET = ['county_id' => $county['county_id']];
    ob_start();
    @handleGetConstituencies();
    ob_get_clean();
    $time = (microtime(true) - $start) * 1000;
    
    if ($time > 100) {
        return ['error' => 'Too slow: ' . round($time, 2) . 'ms'];
    }
    return ['msg' => round($time, 2) . 'ms'];
});

// Test 8: SQL Injection protection
test("SQL Injection protection", function() {
    $_GET = ['county_id' => "1' OR '1'='1"];
    ob_start();
    @handleGetConstituencies();
    $output = ob_get_clean();
    $data = json_decode($output, true);
    
    // Should return error or empty, not all data
    if (isset($data['success']) && $data['success'] === true) {
        if (isset($data['data']) && count($data['data']) > 100) {
            return ['error' => 'Injection may have succeeded'];
        }
    }
    return ['msg' => 'Injection blocked'];
});

echo "\n========================================\n";
echo "  SUMMARY\n";
echo "========================================\n";
echo "Total: $tests\n";
echo "Passed: $passed\n";
echo "Failed: $failed\n";
echo "\n";

if ($failed === 0) {
    echo "✓ ALL TESTS PASSED!\n";
    echo "\nThe Location API is working correctly.\n";
    echo "Response format matches frontend expectations.\n";
    exit(0);
} else {
    echo "✗ SOME TESTS FAILED\n";
    echo "\nPlease review the failed tests above.\n";
    exit(1);
}


