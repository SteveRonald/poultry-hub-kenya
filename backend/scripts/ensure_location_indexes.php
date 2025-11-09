<?php
/**
 * Script to ensure location tables have proper indexes for fast queries
 * Run this script to add indexes if they don't exist
 */

require_once __DIR__ . '/../config/database.php';

try {
    echo "Checking and creating indexes for location tables...\n\n";
    
    // 1. Check/Create index on constituencies.county_id
    echo "1. Checking constituencies.county_id index...\n";
    $checkIndex = $pdo->query("SHOW INDEXES FROM constituencies WHERE Key_name = 'idx_county_id'");
    if ($checkIndex->rowCount() == 0) {
        echo "   Creating idx_county_id index...\n";
        $pdo->exec("CREATE INDEX idx_county_id ON constituencies(county_id)");
        echo "   ✓ Index created successfully\n";
    } else {
        echo "   ✓ Index already exists\n";
    }
    
    // 2. Check/Create index on wards.constituency_id
    echo "\n2. Checking wards.constituency_id index...\n";
    $checkIndex = $pdo->query("SHOW INDEXES FROM wards WHERE Key_name = 'idx_constituency_id'");
    if ($checkIndex->rowCount() == 0) {
        echo "   Creating idx_constituency_id index...\n";
        $pdo->exec("CREATE INDEX idx_constituency_id ON wards(constituency_id)");
        echo "   ✓ Index created successfully\n";
    } else {
        echo "   ✓ Index already exists\n";
    }
    
    // 3. Check/Create index on counties.county_name (for search)
    echo "\n3. Checking counties.county_name index...\n";
    $checkIndex = $pdo->query("SHOW INDEXES FROM counties WHERE Key_name = 'idx_county_name'");
    if ($checkIndex->rowCount() == 0) {
        echo "   Creating idx_county_name index...\n";
        $pdo->exec("CREATE INDEX idx_county_name ON counties(county_name)");
        echo "   ✓ Index created successfully\n";
    } else {
        echo "   ✓ Index already exists\n";
    }
    
    // 4. Check/Create index on constituencies.constituency_name (for search)
    echo "\n4. Checking constituencies.constituency_name index...\n";
    $checkIndex = $pdo->query("SHOW INDEXES FROM constituencies WHERE Key_name = 'idx_constituency_name'");
    if ($checkIndex->rowCount() == 0) {
        echo "   Creating idx_constituency_name index...\n";
        $pdo->exec("CREATE INDEX idx_constituency_name ON constituencies(constituency_name)");
        echo "   ✓ Index created successfully\n";
    } else {
        echo "   ✓ Index already exists\n";
    }
    
    // 5. Check/Create index on wards.ward_name (for search)
    echo "\n5. Checking wards.ward_name index...\n";
    $checkIndex = $pdo->query("SHOW INDEXES FROM wards WHERE Key_name = 'idx_ward_name'");
    if ($checkIndex->rowCount() == 0) {
        echo "   Creating idx_ward_name index...\n";
        $pdo->exec("CREATE INDEX idx_ward_name ON wards(ward_name)");
        echo "   ✓ Index created successfully\n";
    } else {
        echo "   ✓ Index already exists\n";
    }
    
    // 6. Verify table statistics
    echo "\n6. Checking table statistics...\n";
    $stats = $pdo->query("
        SELECT 
            table_name,
            table_rows,
            ROUND(data_length / 1024 / 1024, 2) AS data_size_mb,
            ROUND(index_length / 1024 / 1024, 2) AS index_size_mb
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_name IN ('counties', 'constituencies', 'wards')
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($stats as $stat) {
        echo "   {$stat['table_name']}: {$stat['table_rows']} rows, {$stat['data_size_mb']} MB data, {$stat['index_size_mb']} MB indexes\n";
    }
    
    echo "\n✓ All indexes verified/created successfully!\n";
    echo "\nNote: If queries are still slow, check:\n";
    echo "  1. Database connection is fast (localhost should be instant)\n";
    echo "  2. No locks on tables (check: SHOW PROCESSLIST;)\n";
    echo "  3. MySQL query cache is enabled\n";
    
} catch (PDOException $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    exit(1);
}

