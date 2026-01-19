<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/security.php';

/**
 * Create or get existing conversation for a product and customer
 * POST /api/conversations/create
 */
function handleCreateConversation() {
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
    if (!isset($input['product_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'product_id is required']);
        return;
    }

    $productId = sanitizeInput($input['product_id']);
    $customerId = $payload['user_id'];
    $userRole = $payload['role'] ?? 'customer';

    // Allow customers, admins, and vendors (but vendors can't message their own products)
    if ($userRole !== 'customer' && $userRole !== 'admin' && $userRole !== 'vendor') {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid user role']);
        return;
    }

    try {
        // Get product with vendor info
        $stmt = $pdo->prepare("
            SELECT p.vendor_id, v.user_id as vendor_user_id
            FROM products p
            JOIN vendors v ON p.vendor_id = v.id
            WHERE p.id = ?
        ");
        $stmt->execute([$productId]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$product) {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found']);
            return;
        }

        $vendorId = $product['vendor_id'];
        
        // Prevent vendor from messaging themselves about their own product
        if ($userRole === 'vendor' && $product['vendor_user_id'] == $customerId) {
            http_response_code(403);
            echo json_encode(['error' => 'Failed to load']);
            return;
        }
        
        // For vendors messaging other vendors, treat them as "customer" in the conversation
        // The customer_id will be the vendor's user_id, vendor_id will be the product owner

        // Check if conversation already exists
        $stmt = $pdo->prepare("
            SELECT id, created_at, updated_at 
            FROM conversations 
            WHERE product_id = ? AND customer_id = ?
        ");
        $stmt->execute([$productId, $customerId]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            // Update updated_at
            $stmt = $pdo->prepare("UPDATE conversations SET updated_at = NOW() WHERE id = ?");
            $stmt->execute([$existing['id']]);

            // Get product and vendor info
            $stmt = $pdo->prepare("
                SELECT 
                    p.id as product_id,
                    p.name as product_name,
                    p.image_urls,
                    v.id as vendor_id,
                    v.farm_name,
                    u.id as vendor_user_id
                FROM products p
                JOIN vendors v ON p.vendor_id = v.id
                JOIN user_profiles u ON v.user_id = u.id
                WHERE p.id = ?
            ");
            $stmt->execute([$productId]);
            $productInfo = $stmt->fetch(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'conversation' => [
                    'id' => $existing['id'],
                    'product_id' => $productId,
                    'vendor_id' => $vendorId,
                    'customer_id' => $customerId,
                    'created_at' => $existing['created_at'],
                    'updated_at' => date('Y-m-d H:i:s'),
                    'product' => $productInfo
                ]
            ]);
            return;
        }

        // Create new conversation
        $conversationId = bin2hex(random_bytes(16));
        $stmt = $pdo->prepare("
            INSERT INTO conversations (id, product_id, vendor_id, customer_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, NOW(), NOW())
        ");
        $stmt->execute([$conversationId, $productId, $vendorId, $customerId]);

        // Get product and vendor info
        $stmt = $pdo->prepare("
            SELECT 
                p.id as product_id,
                p.name as product_name,
                p.image_urls,
                v.id as vendor_id,
                v.farm_name,
                u.id as vendor_user_id
            FROM products p
            JOIN vendors v ON p.vendor_id = v.id
            JOIN user_profiles u ON v.user_id = u.id
            WHERE p.id = ?
        ");
        $stmt->execute([$productId]);
        $productInfo = $stmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'conversation' => [
                'id' => $conversationId,
                'product_id' => $productId,
                'vendor_id' => $vendorId,
                'customer_id' => $customerId,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
                'product' => $productInfo
            ]
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error creating conversation: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to create conversation: ' . $e->getMessage()]);
    }
}

/**
 * Get conversation by ID
 * GET /api/conversations/{conversation_id}
 */
function handleGetConversation($conversationId) {
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

    $userId = $payload['user_id'];
    $userRole = $payload['role'] ?? 'customer';

    try {
        // Get vendor_id for vendor users
        $vendorId = null;
        if ($userRole === 'vendor') {
            $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ?");
            $stmt->execute([$userId]);
            $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
            $vendorId = $vendor ? $vendor['id'] : null;
        }

        // Verify user has access to this conversation and get full details
        if ($userRole === 'vendor' && $vendorId) {
            $stmt = $pdo->prepare("
                SELECT 
                    c.*,
                    p.name as product_name,
                    p.image_urls,
                    u.full_name as customer_name,
                    u.id as customer_user_id
                FROM conversations c
                JOIN products p ON c.product_id = p.id
                JOIN user_profiles u ON c.customer_id = u.id
                WHERE c.id = ? AND c.vendor_id = ?
            ");
            $stmt->execute([$conversationId, $vendorId]);
        } else {
            $stmt = $pdo->prepare("
                SELECT 
                    c.*,
                    p.name as product_name,
                    p.image_urls,
                    v.farm_name as vendor_name,
                    u.id as vendor_user_id
                FROM conversations c
                JOIN products p ON c.product_id = p.id
                JOIN vendors v ON c.vendor_id = v.id
                JOIN user_profiles u ON v.user_id = u.id
                WHERE c.id = ? AND c.customer_id = ?
            ");
            $stmt->execute([$conversationId, $userId]);
        }
        
        $conversation = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$conversation) {
            http_response_code(404);
            echo json_encode(['error' => 'Failed to load']);
            return;
        }

        // Process image_urls
        if ($conversation['image_urls']) {
            $images = json_decode($conversation['image_urls'], true);
            if (is_array($images) && count($images) > 0) {
                $conversation['product_image'] = $images[0];
            }
        }
        unset($conversation['image_urls']);

        // Structure conversation with product object
        $conversationData = [
            'id' => $conversation['id'],
            'product_id' => $conversation['product_id'],
            'vendor_id' => $conversation['vendor_id'],
            'customer_id' => $conversation['customer_id'],
            'created_at' => $conversation['created_at'],
            'updated_at' => $conversation['updated_at'],
            'product' => [
                'product_id' => $conversation['product_id'],
                'product_name' => $conversation['product_name'],
                'product_image' => $conversation['product_image'] ?? null,
                'vendor_name' => $conversation['vendor_name'] ?? null,
                'customer_name' => $conversation['customer_name'] ?? null,
                'vendor_user_id' => $conversation['vendor_user_id'] ?? null,
                'customer_user_id' => $conversation['customer_user_id'] ?? null,
            ]
        ];

        echo json_encode([
            'success' => true,
            'conversation' => $conversationData
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error fetching conversation: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to fetch conversation']);
    }
}

/**
 * Get all conversations for current user
 * GET /api/conversations
 */
function handleGetConversations() {
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

    $userId = $payload['user_id'];
    $userRole = $payload['role'] ?? 'customer';

    try {
        if ($userRole === 'vendor') {
            // Get vendor_id
            $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ?");
            $stmt->execute([$userId]);
            $vendor = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$vendor) {
                echo json_encode(['success' => true, 'conversations' => []]);
                return;
            }

            $vendorId = $vendor['id'];

            // Get conversations for this vendor with latest message
            $stmt = $pdo->prepare("
                SELECT 
                    c.id,
                    c.product_id,
                    c.vendor_id,
                    c.customer_id,
                    c.created_at,
                    c.updated_at,
                    p.name as product_name,
                    p.image_urls,
                    u.full_name as customer_name,
                    u.id as customer_user_id,
                    (SELECT message_text FROM messages 
                     WHERE conversation_id = c.id 
                     ORDER BY created_at DESC LIMIT 1) as last_message,
                    (SELECT created_at FROM messages 
                     WHERE conversation_id = c.id 
                     ORDER BY created_at DESC LIMIT 1) as last_message_at,
                    (SELECT COUNT(*) FROM messages 
                     WHERE conversation_id = c.id AND is_read = 0 AND sender_role = 'customer') as unread_count
                FROM conversations c
                JOIN products p ON c.product_id = p.id
                JOIN user_profiles u ON c.customer_id = u.id
                WHERE c.vendor_id = ?
                ORDER BY c.updated_at DESC
            ");
            $stmt->execute([$vendorId]);
        } else {
            // Get conversations for this customer with latest message
            $stmt = $pdo->prepare("
                SELECT 
                    c.id,
                    c.product_id,
                    c.vendor_id,
                    c.customer_id,
                    c.created_at,
                    c.updated_at,
                    p.name as product_name,
                    p.image_urls,
                    v.farm_name as vendor_name,
                    u.id as vendor_user_id,
                    (SELECT message_text FROM messages 
                     WHERE conversation_id = c.id 
                     ORDER BY created_at DESC LIMIT 1) as last_message,
                    (SELECT created_at FROM messages 
                     WHERE conversation_id = c.id 
                     ORDER BY created_at DESC LIMIT 1) as last_message_at,
                    (SELECT COUNT(*) FROM messages 
                     WHERE conversation_id = c.id AND is_read = 0 AND sender_role = 'vendor') as unread_count
                FROM conversations c
                JOIN products p ON c.product_id = p.id
                JOIN vendors v ON c.vendor_id = v.id
                JOIN user_profiles u ON v.user_id = u.id
                WHERE c.customer_id = ?
                ORDER BY c.updated_at DESC
            ");
            $stmt->execute([$userId]);
        }

        $conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Process image_urls
        foreach ($conversations as &$conv) {
            if ($conv['image_urls']) {
                $images = json_decode($conv['image_urls'], true);
                if (is_array($images) && count($images) > 0) {
                    $conv['product_image'] = $images[0];
                }
            }
            unset($conv['image_urls']);
        }

        echo json_encode([
            'success' => true,
            'conversations' => $conversations
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error fetching conversations: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to fetch conversations']);
    }
}

?>


















