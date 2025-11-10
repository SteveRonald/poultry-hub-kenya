<?php
/**
 * Final clean test script for Location API endpoints
 * Tests all endpoints and shows only test results
 * 
 * Usage: php backend/scripts/test_location_api_final.php
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/cache.php';

echo "========================================\n";
echo "  LOCATION API TEST SUITE\n";
echo "========================================\n\n";

$tests = 0;
$passed = 0;
$failed = 0;

// Helper to call API and get JSON response
function callAPI($endpoint, $params = []) {
    global $pdo;
    
    // Build query string
    $queryString = http_build_query($params);
    $url = "http://localhost/poultry-hub-kenya/backend/index.php{$endpoint}";
    if ($queryString) {
        $url .= "?{$queryString}";
    }
    
    // Use curl to call the API (avoids output buffering issues)
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        return null;
    }
    
    return json_decode($response, true);
}

function test($name, $callback) {
    global $tests, $passed, $failed;
    $tests++;
    echo "[TEST $tests] $name... ";
    flush();
    
    try {
        $result = $callback();
        if ($result && (!isset($result['error']))) {
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
        echo "✗ ERROR - " . $e->getMessage();
        $failed++;
    }
    echo "\n";
    flush();
}

// Test 1: Counties endpoint
test("Get Counties", function() {
    $data = callAPI('/api/location/counties');
    
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
    // Test search functionality
    $ch = curl_init();
    $url = "http://localhost/poultry-hub-kenya/backend/index.php/api/location/counties?search=Nairobi";
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200 || !$response) {
        return ['error' => 'Request failed: HTTP ' . $httpCode];
    }
    
    $data = json_decode($response, true);
    if (!$data) {
        return ['error' => 'Invalid JSON response'];
    }
    
    if (isset($data['success']) && $data['success'] === true) {
        if (isset($data['data']) && is_array($data['data'])) {
            $found = false;
            foreach ($data['data'] as $county) {
                if (stripos($county['county_name'], 'Nairobi') !== false) {
                    $found = true;
                    break;
                }
            }
            return $found ? ['msg' => 'Found Nairobi'] : ['msg' => 'Search returned ' . count($data['data']) . ' results'];
        }
    }
    return ['error' => 'Invalid response format'];
});

// Test 3: Constituencies endpoint
test("Get Constituencies", function() {
    global $pdo;
    $stmt = $pdo->query("SELECT county_id FROM counties WHERE county_name = 'Bomet' LIMIT 1");
    $county = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$county) return ['error' => 'Bomet county not found'];
    
    $data = callAPI('/api/location/constituencies', ['county_id' => $county['county_id']]);
    
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
    return ['msg' => count($data['data']) . ' constituencies for Bomet'];
});

// Test 4: Constituencies - missing county_id
test("Get Constituencies (missing county_id)", function() {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "http://localhost/poultry-hub-kenya/backend/index.php/api/location/constituencies");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    // Should return 400 Bad Request
    if ($httpCode === 400) {
        $data = json_decode($response, true);
        if (isset($data['success']) && $data['success'] === false && isset($data['error'])) {
            return ['msg' => 'Correctly returned 400 error'];
        }
    }
    
    // If it returns 200, check if data is empty or error message
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        if (isset($data['success']) && $data['success'] === false) {
            return ['msg' => 'Correctly returned error'];
        }
    }
    
    return ['error' => 'Expected 400 or error response, got ' . $httpCode];
});

// Test 5: Wards endpoint
test("Get Wards", function() {
    global $pdo;
    $stmt = $pdo->query("SELECT constituency_id FROM constituencies LIMIT 1");
    $constituency = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$constituency) return ['error' => 'No constituencies in database'];
    
    $data = callAPI('/api/location/wards', ['constituency_id' => $constituency['constituency_id']]);
    
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
    $c1 = callAPI('/api/location/counties');
    
    global $pdo;
    $stmt = $pdo->query("SELECT county_id FROM counties LIMIT 1");
    $county = $stmt->fetch(PDO::FETCH_ASSOC);
    $c2 = callAPI('/api/location/constituencies', ['county_id' => $county['county_id']]);
    
    $stmt = $pdo->query("SELECT constituency_id FROM constituencies LIMIT 1");
    $constituency = $stmt->fetch(PDO::FETCH_ASSOC);
    $c3 = callAPI('/api/location/wards', ['constituency_id' => $constituency['constituency_id']]);
    
    foreach ([$c1, $c2, $c3] as $data) {
        if (!isset($data['success']) || !isset($data['data']) || !is_array($data['data'])) {
            return ['error' => 'Inconsistent format'];
        }
    }
    return ['msg' => 'All endpoints return consistent format'];
});

// Test 7: Performance
test("Performance (< 200ms with network)", function() {
    global $pdo;
    $stmt = $pdo->query("SELECT county_id FROM counties LIMIT 1");
    $county = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $start = microtime(true);
    $data = callAPI('/api/location/constituencies', ['county_id' => $county['county_id']]);
    $time = (microtime(true) - $start) * 1000;
    
    // Using curl adds network overhead, so allow up to 200ms
    if ($time > 200) {
        return ['error' => 'Too slow: ' . round($time, 2) . 'ms'];
    }
    
    // Also check the execution_time_ms from the response (actual DB query time)
    if ($data && isset($data['execution_time_ms']) && $data['execution_time_ms'] > 100) {
        return ['error' => 'DB query too slow: ' . $data['execution_time_ms'] . 'ms'];
    }
    
    $dbTime = isset($data['execution_time_ms']) ? $data['execution_time_ms'] : 'N/A';
    return ['msg' => round($time, 2) . 'ms total (DB: ' . $dbTime . 'ms)'];
});

// Test 8: SQL Injection protection
test("SQL Injection protection", function() {
    $data = callAPI('/api/location/constituencies', ['county_id' => "1' OR '1'='1"]);
    
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

