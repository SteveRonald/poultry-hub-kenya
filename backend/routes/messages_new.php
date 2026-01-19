<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/security.php';

/**
 * Send a message
 * POST /api/messages/send
 */
function handleSendMessage() {
    global $pdo;

    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Failed to load']);
        return;
    }

    $payload = validateAuthToken($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Failed to load']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['conversation_id']) || !isset($input['message_text'])) {
        http_response_code(400);
        echo json_encode(['error' => 'conversation_id and message_text are required']);
        return;
    }

    $conversationId = sanitizeInput($input['conversation_id']);
    $messageText = sanitizeInput($input['message_text']);
    $senderId = $payload['user_id'];
    $senderRole = $payload['role'] ?? 'customer';

    // Validate message length
    if (strlen($messageText) > 5000) {
        http_response_code(400);
        echo json_encode(['error' => 'Message is too long. Maximum length is 5000 characters.']);
        return;
    }

    if (empty(trim($messageText))) {
        http_response_code(400);
        echo json_encode(['error' => 'Message cannot be empty']);
        return;
    }

    try {
        // Verify user has access to this conversation
        $stmt = $pdo->prepare("
            SELECT customer_id, vendor_id 
            FROM conversations 
            WHERE id = ?
        ");
        $stmt->execute([$conversationId]);
        $conversation = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$conversation) {
            http_response_code(404);
            echo json_encode(['error' => 'Failed to load']);
            return;
        }

        // Verify sender is part of the conversation
        if ($senderRole === 'customer') {
            if ($conversation['customer_id'] != $senderId) {
                http_response_code(403);
                echo json_encode(['error' => 'Failed to load']);
                return;
            }
        } else if ($senderRole === 'vendor') {
            // Get vendor_id for this user
            $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ?");
            $stmt->execute([$senderId]);
            $vendor = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$vendor || $conversation['vendor_id'] != $vendor['id']) {
                http_response_code(403);
                echo json_encode(['error' => 'Failed to load']);
                return;
            }
        } else {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid role']);
            return;
        }

        // Insert message
        $messageId = bin2hex(random_bytes(16));
        $stmt = $pdo->prepare("
            INSERT INTO messages (id, conversation_id, sender_id, sender_role, message_text, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, FALSE, NOW())
        ");
        $stmt->execute([$messageId, $conversationId, $senderId, $senderRole, $messageText]);

        // Update conversation updated_at
        $stmt = $pdo->prepare("UPDATE conversations SET updated_at = NOW() WHERE id = ?");
        $stmt->execute([$conversationId]);

        // Get the created message
        $stmt = $pdo->prepare("
            SELECT id, conversation_id, sender_id, sender_role, message_text, is_read, created_at
            FROM messages
            WHERE id = ?
        ");
        $stmt->execute([$messageId]);
        $message = $stmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'message' => $message
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error sending message: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to send message: ' . $e->getMessage()]);
    }
}

/**
 * Get messages for a conversation
 * GET /api/messages?conversation_id={id}
 */
function handleGetMessages() {
    global $pdo;

    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Failed to load']);
        return;
    }

    $payload = validateAuthToken($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Failed to load']);
        return;
    }

    $conversationId = isset($_GET['conversation_id']) ? sanitizeInput($_GET['conversation_id']) : null;
    if (!$conversationId) {
        http_response_code(400);
        echo json_encode(['error' => 'conversation_id is required']);
        return;
    }

    $userId = $payload['user_id'];
    $userRole = $payload['role'] ?? 'customer';

    try {
        // Verify user has access to this conversation
        $stmt = $pdo->prepare("
            SELECT customer_id, vendor_id 
            FROM conversations 
            WHERE id = ?
        ");
        $stmt->execute([$conversationId]);
        $conversation = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$conversation) {
            http_response_code(404);
            echo json_encode(['error' => 'Failed to load']);
            return;
        }

        // Verify access
        if ($userRole === 'customer') {
            if ($conversation['customer_id'] != $userId) {
                http_response_code(403);
                echo json_encode(['error' => 'Failed to load']);
                return;
            }
        } else if ($userRole === 'vendor') {
            $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ?");
            $stmt->execute([$userId]);
            $vendor = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$vendor || $conversation['vendor_id'] != $vendor['id']) {
                http_response_code(403);
                echo json_encode(['error' => 'Failed to load']);
                return;
            }
        }

        // Get messages
        $stmt = $pdo->prepare("
            SELECT id, conversation_id, sender_id, sender_role, message_text, is_read, created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
        ");
        $stmt->execute([$conversationId]);
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'messages' => $messages
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error fetching messages: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to fetch messages']);
    }
}

/**
 * Mark messages as read
 * POST /api/messages/read
 */
function handleMarkMessagesAsRead() {
    global $pdo;

    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Failed to load']);
        return;
    }

    $payload = validateAuthToken($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Failed to load']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['conversation_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'conversation_id is required']);
        return;
    }

    $conversationId = sanitizeInput($input['conversation_id']);
    $userId = $payload['user_id'];
    $userRole = $payload['role'] ?? 'customer';

    try {
        // Verify user has access to this conversation
        $stmt = $pdo->prepare("
            SELECT customer_id, vendor_id 
            FROM conversations 
            WHERE id = ?
        ");
        $stmt->execute([$conversationId]);
        $conversation = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$conversation) {
            http_response_code(404);
            echo json_encode(['error' => 'Failed to load']);
            return;
        }

        // Determine which role's messages to mark as read
        $targetRole = $userRole === 'customer' ? 'vendor' : 'customer';

        // Mark messages as read
        $stmt = $pdo->prepare("
            UPDATE messages 
            SET is_read = TRUE 
            WHERE conversation_id = ? 
            AND sender_role = ? 
            AND is_read = FALSE
        ");
        $stmt->execute([$conversationId, $targetRole]);

        echo json_encode([
            'success' => true,
            'message' => 'Messages marked as read'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error marking messages as read: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to mark messages as read']);
    }
}

/**
 * Delete a message
 * DELETE /api/messages/{messageId}
 */
function handleDeleteMessage() {
    global $pdo;

    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Failed to load']);
        return;
    }

    $payload = validateAuthToken($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Failed to load']);
        return;
    }

    $messageId = isset($_GET['message_id']) ? sanitizeInput($_GET['message_id']) : null;
    if (!$messageId) {
        http_response_code(400);
        echo json_encode(['error' => 'message_id is required']);
        return;
    }

    $userId = $payload['user_id'];
    $userRole = $payload['role'] ?? 'customer';

    try {
        // Get message and verify ownership
        $stmt = $pdo->prepare("
            SELECT m.id, m.sender_id, m.conversation_id, m.sender_role
            FROM messages m
            WHERE m.id = ?
        ");
        $stmt->execute([$messageId]);
        $message = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$message) {
            http_response_code(404);
            echo json_encode(['error' => 'Failed to load']);
            return;
        }

        // Only allow deleting own messages
        if ($message['sender_id'] != $userId) {
            http_response_code(403);
            echo json_encode(['error' => 'Failed to load']);
            return;
        }

        // Delete the message
        $stmt = $pdo->prepare("DELETE FROM messages WHERE id = ?");
        $stmt->execute([$messageId]);

        echo json_encode([
            'success' => true,
            'message' => 'Message deleted successfully'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error deleting message: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to delete message']);
    }
}

/**
 * Delete entire conversation
 * DELETE /api/conversations/{conversationId}
 */
function handleDeleteConversation() {
    global $pdo;

    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Failed to load']);
        return;
    }

    $payload = validateAuthToken($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Failed to load']);
        return;
    }

    // Get conversation ID from GET parameter (set in index.php from URL path)
    $conversationId = isset($_GET['conversation_id']) ? sanitizeInput($_GET['conversation_id']) : null;
    if (!$conversationId) {
        http_response_code(400);
        echo json_encode(['error' => 'conversation_id is required']);
        return;
    }

    $userId = $payload['user_id'];
    $userRole = $payload['role'] ?? 'customer';

    try {
        // Verify user has access to this conversation
        $stmt = $pdo->prepare("
            SELECT customer_id, vendor_id 
            FROM conversations 
            WHERE id = ?
        ");
        $stmt->execute([$conversationId]);
        $conversation = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$conversation) {
            http_response_code(404);
            echo json_encode(['error' => 'Failed to load']);
            return;
        }

        // Verify access
        if ($userRole === 'customer') {
            if ($conversation['customer_id'] != $userId) {
                http_response_code(403);
                echo json_encode(['error' => 'Failed to load']);
                return;
            }
        } else if ($userRole === 'vendor') {
            $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ?");
            $stmt->execute([$userId]);
            $vendor = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$vendor || $conversation['vendor_id'] != $vendor['id']) {
                http_response_code(403);
                echo json_encode(['error' => 'Failed to load']);
                return;
            }
        }

        // Delete all messages in the conversation
        $stmt = $pdo->prepare("DELETE FROM messages WHERE conversation_id = ?");
        $stmt->execute([$conversationId]);

        // Delete the conversation
        $stmt = $pdo->prepare("DELETE FROM conversations WHERE id = ?");
        $stmt->execute([$conversationId]);

        echo json_encode([
            'success' => true,
            'message' => 'Conversation deleted successfully'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error deleting conversation: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to delete conversation']);
    }
}

?>


















