<?php
/**
 * Safe Database Migration Script for Chat System
 * Checks for existing tables, drops them if they exist, and creates new ones
 */

require_once __DIR__ . '/../config/database.php';

echo "Starting chat system database migration...\n\n";

try {
    // Check if conversations table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'conversations'");
    $conversationsExists = $stmt->rowCount() > 0;
    
    // Check if messages table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'messages'");
    $messagesExists = $stmt->rowCount() > 0;
    
    if ($conversationsExists || $messagesExists) {
        echo "Existing tables found:\n";
        if ($conversationsExists) echo "  - conversations\n";
        if ($messagesExists) echo "  - messages\n";
        echo "\nDropping existing tables...\n";
        
        // Drop messages first (due to foreign key constraint)
        if ($messagesExists) {
            try {
                $pdo->exec("DROP TABLE IF EXISTS messages");
                echo "  ✓ Dropped 'messages' table\n";
            } catch (PDOException $e) {
                echo "  ✗ Error dropping 'messages' table: " . $e->getMessage() . "\n";
            }
        }
        
        // Drop conversations
        if ($conversationsExists) {
            try {
                $pdo->exec("DROP TABLE IF EXISTS conversations");
                echo "  ✓ Dropped 'conversations' table\n";
            } catch (PDOException $e) {
                echo "  ✗ Error dropping 'conversations' table: " . $e->getMessage() . "\n";
            }
        }
        
        echo "\n";
    } else {
        echo "No existing chat tables found. Creating new tables...\n\n";
    }
    
    // Create conversations table
    echo "Creating 'conversations' table...\n";
    $pdo->exec("
        CREATE TABLE conversations (
            id CHAR(36) PRIMARY KEY,
            product_id CHAR(36) NOT NULL,
            vendor_id CHAR(36) NOT NULL,
            customer_id CHAR(36) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_product_customer (product_id, customer_id),
            INDEX idx_vendor (vendor_id),
            INDEX idx_customer (customer_id),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
            FOREIGN KEY (customer_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
            UNIQUE KEY unique_product_customer (product_id, customer_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");
    echo "  ✓ Created 'conversations' table\n";
    
    // Create messages table
    echo "Creating 'messages' table...\n";
    $pdo->exec("
        CREATE TABLE messages (
            id CHAR(36) PRIMARY KEY,
            conversation_id CHAR(36) NOT NULL,
            sender_id CHAR(36) NOT NULL,
            sender_role ENUM('customer', 'vendor') NOT NULL,
            message_text TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_conversation (conversation_id),
            INDEX idx_sender (sender_id),
            INDEX idx_created (created_at),
            INDEX idx_read (is_read),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES user_profiles(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");
    echo "  ✓ Created 'messages' table\n";
    
    echo "\n✅ Migration completed successfully!\n";
    echo "\nTables created:\n";
    echo "  - conversations\n";
    echo "  - messages\n";
    
} catch (PDOException $e) {
    echo "\n❌ Migration failed!\n";
    echo "Error: " . $e->getMessage() . "\n";
    echo "Code: " . $e->getCode() . "\n";
    exit(1);
}

?>


















