<?php
/**
 * Test script to verify location API endpoints are working and fast
 */

require_once __DIR__ . '/../config/database.php';

echo "Testing Location API Endpoints...\n\n";

// Test 1: Get Counties
echo "1. Testing GET /api/location/counties\n";
$startTime = microtime(true);
try {
    $stmt = $pdo->query("SELECT county_id, county_name, county_code FROM counties ORDER BY county_name ASC LIMIT 50");
    $counties = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $time = round((microtime(true) - $startTime) * 1000, 2);
    echo "   ✓ Success: Found " . count($counties) . " counties in {$time}ms\n";
    if ($time > 50) {
        echo "   ⚠ WARNING: Query took {$time}ms (should be < 50ms)\n";
    }
} catch (Exception $e) {
    echo "   ✗ Error: " . $e->getMessage() . "\n";
}

// Test 2: Get Constituencies for first county
echo "\n2. Testing GET /api/location/constituencies?county_id=1\n";
$startTime = microtime(true);
try {
    $stmt = $pdo->prepare("SELECT constituency_id, constituency_name, county_id FROM constituencies WHERE county_id = ? ORDER BY constituency_name ASC LIMIT 100");
    $stmt->execute([1]);
    $constituencies = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $time = round((microtime(true) - $startTime) * 1000, 2);
    echo "   ✓ Success: Found " . count($constituencies) . " constituencies in {$time}ms\n";
    if ($time > 100) {
        echo "   ⚠ WARNING: Query took {$time}ms (should be < 100ms)\n";
    }
    if (count($constituencies) > 0) {
        echo "   Sample: " . $constituencies[0]['constituency_name'] . "\n";
    }
} catch (Exception $e) {
    echo "   ✗ Error: " . $e->getMessage() . "\n";
}

// Test 3: Get Wards for first constituency
echo "\n3. Testing GET /api/location/wards?constituency_id=1\n";
$startTime = microtime(true);
try {
    $stmt = $pdo->prepare("SELECT ward_id, ward_name, constituency_id FROM wards WHERE constituency_id = ? ORDER BY ward_name ASC LIMIT 100");
    $stmt->execute([1]);
    $wards = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $time = round((microtime(true) - $startTime) * 1000, 2);
    echo "   ✓ Success: Found " . count($wards) . " wards in {$time}ms\n";
    if ($time > 100) {
        echo "   ⚠ WARNING: Query took {$time}ms (should be < 100ms)\n";
    }
    if (count($wards) > 0) {
        echo "   Sample: " . $wards[0]['ward_name'] . "\n";
    }
} catch (Exception $e) {
    echo "   ✗ Error: " . $e->getMessage() . "\n";
}

// Test 4: Explain query to check if index is being used
echo "\n4. Checking if indexes are being used...\n";
try {
    $stmt = $pdo->prepare("EXPLAIN SELECT constituency_id, constituency_name, county_id FROM constituencies WHERE county_id = 1");
    $stmt->execute();
    $explain = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($explain) > 0) {
        $row = $explain[0];
        echo "   Key used: " . ($row['key'] ?? 'NULL') . "\n";
        echo "   Type: " . ($row['type'] ?? 'NULL') . "\n";
        echo "   Rows examined: " . ($row['rows'] ?? 'NULL') . "\n";
        if (($row['key'] ?? '') === 'idx_county_id') {
            echo "   ✓ Index is being used correctly\n";
        } else {
            echo "   ⚠ WARNING: Index might not be used (key: " . ($row['key'] ?? 'NULL') . ")\n";
        }
    }
} catch (Exception $e) {
    echo "   ✗ Error: " . $e->getMessage() . "\n";
}

echo "\n✓ All tests completed!\n";

