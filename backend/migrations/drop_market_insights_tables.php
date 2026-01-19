<?php
/**
 * Database Migration: Drop Market Insights Tables
 *
 * This migration removes all market insights related tables that are no longer needed
 * after the market insights feature was removed from the application.
 *
 * Tables to be dropped:
 * - market_prices
 * - predicted_prices
 * - market_insights_metadata
 */

require_once __DIR__ . '/../config/database.php';

try {
    // Check if tables exist before dropping them
    $tablesToDrop = [
        'market_prices',
        'predicted_prices',
        'market_insights_metadata'
    ];

    $pdo->beginTransaction();

    foreach ($tablesToDrop as $tableName) {
        // Check if table exists using proper SQL syntax
        $stmt = $pdo->query("SHOW TABLES LIKE '{$tableName}'");
        $tableExists = $stmt->fetch();

        if ($tableExists) {
            echo "Dropping table: {$tableName}\n";

            // Drop the table
            $pdo->exec("DROP TABLE `{$tableName}`");

            echo "✅ Successfully dropped table: {$tableName}\n";
        } else {
            echo "ℹ️  Table {$tableName} does not exist, skipping...\n";
        }
    }

    $pdo->commit();

    echo "\n🎉 Migration completed successfully!\n";
    echo "All market insights tables have been removed from the database.\n";

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    // If the error is just about no active transaction, that's fine - the tables were already dropped
    if (strpos($e->getMessage(), 'There is no active transaction') === false) {
        echo "❌ Migration failed: " . $e->getMessage() . "\n";
        echo "Please check your database connection and try again.\n";
        exit(1);
    } else {
        echo "\n🎉 Migration completed successfully!\n";
        echo "All market insights tables have been removed from the database.\n";
    }
}
?>
