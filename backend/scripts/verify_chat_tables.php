<?php
require_once __DIR__ . '/../config/database.php';

echo "Verifying chat tables...\n\n";

try {
    // Check conversations table
    $stmt = $pdo->query("SHOW TABLES LIKE 'conversations'");
    $conversationsExists = $stmt->rowCount() > 0;
    echo "Conversations table: " . ($conversationsExists ? "✓ EXISTS" : "✗ MISSING") . "\n";
    
    // Check messages table
    $stmt = $pdo->query("SHOW TABLES LIKE 'messages'");
    $messagesExists = $stmt->rowCount() > 0;
    echo "Messages table: " . ($messagesExists ? "✓ EXISTS" : "✗ MISSING") . "\n";
    
    if ($conversationsExists) {
        $stmt = $pdo->query("DESCRIBE conversations");
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo "\nConversations table structure:\n";
        foreach ($columns as $col) {
            echo "  - {$col['Field']}: {$col['Type']}\n";
        }
    }
    
    if ($messagesExists) {
        $stmt = $pdo->query("DESCRIBE messages");
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo "\nMessages table structure:\n";
        foreach ($columns as $col) {
            echo "  - {$col['Field']}: {$col['Type']}\n";
        }
    }
    
    if ($conversationsExists && $messagesExists) {
        echo "\n✅ All chat tables are ready!\n";
    }
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

?>

