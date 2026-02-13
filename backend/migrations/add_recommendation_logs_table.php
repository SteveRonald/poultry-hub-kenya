<?php
// Database migration to add recommendation_logs table

require_once __DIR__ . '/../config/database.php';

try {
    $pdo->beginTransaction();

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS recommendation_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            scope ENUM('vendor', 'admin') NOT NULL,
            scope_id INT NULL,
            period_type ENUM('daily', 'weekly') NOT NULL,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            metrics_json JSON NOT NULL,
            actions_json JSON NOT NULL,
            emailed_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_scope_scopeid (scope, scope_id),
            INDEX idx_period (period_type, period_start, period_end),
            INDEX idx_emailed_at (emailed_at),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->commit();

    echo "✅ recommendation_logs table created successfully\n";
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "❌ Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
?>
