<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/security.php';

function generateUUID() {
    try {
        return bin2hex(random_bytes(16));
    } catch (Exception $e) {
        return uniqid('', true);
    }
}

function handleSendMessage() {
    global $pdo;

    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }

    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['product_id']) || !isset($input['receiver_id']) || !isset($input['message'])) {
        http_response_code(400);
        echo json_encode(['error' => 'product_id, receiver_id and message are required']);
        return;
    }

    $id = generateUUID();
    $productId = sanitizeInput($input['product_id']);
    $senderId = $payload['user_id'];
    $receiverId = sanitizeInput($input['receiver_id']);
    $message = sanitizeInput($input['message']);
    $senderType = $payload['role'] ?? 'customer';

    try {
        $stmt = $pdo->prepare("INSERT INTO messages (id, product_id, sender_id, receiver_id, sender_type, message, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
        $stmt->execute([$id, $productId, $senderId, $receiverId, $senderType, $message]);

        echo json_encode([
            'success' => true,
            'message' => [
                'id' => $id,
                'product_id' => $productId,
                'sender_id' => $senderId,
                'receiver_id' => $receiverId,
                'sender_type' => $senderType,
                'message' => $message,
                'created_at' => date('Y-m-d H:i:s')
            ]
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save message: ' . $e->getMessage()]);
    }
}

function handleGetMessages() {
    global $pdo;

    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }

    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }

    $productId = isset($_GET['product_id']) ? sanitizeInput($_GET['product_id']) : null;
    if (!$productId) {
        http_response_code(400);
        echo json_encode(['error' => 'product_id is required']);
        return;
    }

    try {
        $userId = $payload['user_id'];
        $stmt = $pdo->prepare("SELECT * FROM messages WHERE product_id = ? AND (sender_id = ? OR receiver_id = ?) ORDER BY created_at ASC");
        $stmt->execute([$productId, $userId, $userId]);
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($messages);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch messages: ' . $e->getMessage()]);
    }
}

function handleGetVendorConversations() {
    global $pdo;

    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }

    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }

    try {
        $currentUserId = $payload['user_id'];
        
        // Get vendor_id for this user
        $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ?");
        $stmt->execute([$currentUserId]);
        $vendorRow = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$vendorRow) {
            // User is not a vendor
            echo json_encode([]);
            return;
        }
        
        $vendorId = $vendorRow['id'];
        
        // Get all unique conversations where the user is the receiver (vendor)
        // Get the latest message for each sender-product combination
        $stmt = $pdo->prepare("
            SELECT 
                m.id,
                m.product_id,
                m.sender_id,
                m.receiver_id,
                m.message,
                m.created_at,
                p.name as product_name,
                p.image_urls,
                u.full_name as sender_name
            FROM messages m
            JOIN products p ON m.product_id = p.id
            JOIN user_profiles u ON m.sender_id = u.id
            WHERE m.receiver_id = ?
            ORDER BY m.created_at DESC
            LIMIT 50
        ");
        $stmt->execute([$vendorId]);
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Group by sender-product combination to show latest message per conversation
        $conversations = [];
        $seen = [];
        
        foreach ($messages as $msg) {
            $key = $msg['sender_id'] . '_' . $msg['product_id'];
            if (!isset($seen[$key])) {
                // Get first image from image_urls JSON array
                $imageUrl = null;
                if ($msg['image_urls']) {
                    $images = json_decode($msg['image_urls'], true);
                    if (is_array($images) && count($images) > 0) {
                        $imageUrl = $images[0];
                    }
                }
                
                $conversations[] = [
                    'product_id' => $msg['product_id'],
                    'product_name' => $msg['product_name'],
                    'sender_id' => $msg['sender_id'],
                    'sender_name' => $msg['sender_name'],
                    'message' => $msg['message'],
                    'created_at' => $msg['created_at'],
                    'image_url' => $imageUrl
                ];
                $seen[$key] = true;
            }
        }
        
        echo json_encode($conversations);
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error fetching vendor conversations: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to fetch conversations: ' . $e->getMessage()]);
    }
}

function handleGetUserConversations() {
    global $pdo;

    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }

    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }

    try {
        $currentUserId = $payload['user_id'];

        // Fetch latest messages where the user is either sender or receiver
        $stmt = $pdo->prepare("SELECT 
                m.id,
                m.product_id,
                m.sender_id,
                m.receiver_id,
                m.message,
                m.created_at,
                p.name as product_name,
                p.image_urls,
                u.full_name as other_name
            FROM messages m
            JOIN products p ON m.product_id = p.id
            LEFT JOIN user_profiles u ON (CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END) = u.id
            WHERE m.sender_id = ? OR m.receiver_id = ?
            ORDER BY m.created_at DESC
            LIMIT 200");

        $stmt->execute([$currentUserId, $currentUserId, $currentUserId]);
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $conversations = [];
        $seen = [];

        foreach ($messages as $msg) {
            $otherId = ($msg['sender_id'] == $currentUserId) ? $msg['receiver_id'] : $msg['sender_id'];
            $key = $otherId . '_' . $msg['product_id'];
            if (!isset($seen[$key])) {
                $imageUrl = null;
                if ($msg['image_urls']) {
                    $images = json_decode($msg['image_urls'], true);
                    if (is_array($images) && count($images) > 0) {
                        $imageUrl = $images[0];
                    }
                }

                $conversations[] = [
                    'product_id' => $msg['product_id'],
                    'product_name' => $msg['product_name'],
                    'other_id' => $otherId,
                    'other_name' => $msg['other_name'] ?: null,
                    'message' => $msg['message'],
                    'created_at' => $msg['created_at'],
                    'image_url' => $imageUrl
                ];
                $seen[$key] = true;
            }
        }

        echo json_encode($conversations);
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error fetching user conversations: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to fetch conversations: ' . $e->getMessage()]);
    }
}

?>
