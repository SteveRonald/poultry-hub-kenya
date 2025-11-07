<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/security.php';
require_once __DIR__ . '/../utils/chat_helpers.php';

/**
 * Generate UUID
 */
function generateUUID() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

/**
 * Get or create session ID
 */
function getOrCreateSessionId() {
    // Try to get session ID from cookie or generate new one
    // SECURITY: Sanitize and validate cookie value
    if (isset($_COOKIE['chat_session_id'])) {
        $sessionId = filter_var($_COOKIE['chat_session_id'], FILTER_SANITIZE_STRING);
        // Validate session ID format (UUID or alphanumeric)
        if (preg_match('/^[a-zA-Z0-9_-]+$/', $sessionId) && strlen($sessionId) <= 100) {
            return $sessionId;
        }
    }
    
    $sessionId = 'chat_' . time() . '_' . bin2hex(random_bytes(8));
    setcookie('chat_session_id', $sessionId, time() + (86400 * 30), '/'); // 30 days
    return $sessionId;
}

/**
 * Get or create conversation
 */
function getOrCreateConversation($sessionId, $userId = null) {
    global $pdo;
    
    try {
        // Try to find active conversation
        $stmt = $pdo->prepare("
            SELECT id FROM chat_conversations 
            WHERE session_id = ? AND status = 'active'
            ORDER BY created_at DESC LIMIT 1
        ");
        $stmt->execute([$sessionId]);
        $conversation = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($conversation) {
            // Update user_id if user logged in
            if ($userId) {
                $updateStmt = $pdo->prepare("
                    UPDATE chat_conversations SET user_id = ? WHERE id = ?
                ");
                $updateStmt->execute([$userId, $conversation['id']]);
            }
            return $conversation['id'];
        }
        
        // Create new conversation
        $conversationId = generateUUID();
        $stmt = $pdo->prepare("
            INSERT INTO chat_conversations (id, user_id, session_id, status, language)
            VALUES (?, ?, ?, 'active', 'en')
        ");
        $stmt->execute([$conversationId, $userId, $sessionId]);
        
        return $conversationId;
    } catch (PDOException $e) {
        error_log("Error in getOrCreateConversation: " . $e->getMessage());
        return null;
    }
}

/**
 * Detect intent from user message with improved fuzzy matching
 */
function detectIntent($message, $conversationId = null) {
    global $pdo;
    
    try {
        // Normalize message
        $normalizedMessage = normalizeMessage($message);
        $messageLower = strtolower(trim($message));
        $words = explode(' ', $messageLower);
        
        // Get context from previous messages if available
        $context = [];
        if ($conversationId) {
            $context = getContextFromHistory($conversationId, $pdo, 3);
        }
        
        // Quick checks for common questions - prioritize account creation
        if (isAccountCreationQuestion($message)) {
            $stmt = $pdo->prepare("
                SELECT id, intent_name, keywords, response_template, requires_auth, action_type
                FROM chat_intents 
                WHERE intent_name = 'account_help' AND is_active = TRUE
            ");
            $stmt->execute();
            $accountIntent = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($accountIntent) {
                error_log("Quick match: Account creation intent detected for message: '$message'");
                return $accountIntent;
            }
        }
        
        if (isContactQuestion($message)) {
            $stmt = $pdo->prepare("
                SELECT id, intent_name, keywords, response_template, requires_auth, action_type
                FROM chat_intents 
                WHERE intent_name = 'contact' AND is_active = TRUE
            ");
            $stmt->execute();
            $contactIntent = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($contactIntent) {
                return $contactIntent;
            }
        }
        
        if (isAboutQuestion($message)) {
            $stmt = $pdo->prepare("
                SELECT id, intent_name, keywords, response_template, requires_auth, action_type
                FROM chat_intents 
                WHERE intent_name = 'about' AND is_active = TRUE
            ");
            $stmt->execute();
            $aboutIntent = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($aboutIntent) {
                return $aboutIntent;
            }
        }
        
        if (isProductQuestion($message)) {
            $stmt = $pdo->prepare("
                SELECT id, intent_name, keywords, response_template, requires_auth, action_type
                FROM chat_intents 
                WHERE intent_name = 'product_search' AND is_active = TRUE
            ");
            $stmt->execute();
            $productIntent = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($productIntent) {
                return $productIntent;
            }
        }
        
        // Get all active intents (except default)
        $stmt = $pdo->query("
            SELECT id, intent_name, keywords, response_template, requires_auth, action_type
            FROM chat_intents 
            WHERE is_active = TRUE AND intent_name != 'default'
            ORDER BY id ASC
        ");
        $intents = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $bestMatch = null;
        $bestScore = 0;
        
        foreach ($intents as $intent) {
            $keywords = json_decode($intent['keywords'], true) ?? [];
            
            // Use fuzzy matching
            $fuzzyResult = fuzzyMatchIntent($message, $keywords, 0.5);
            $score = $fuzzyResult['score'];
            
            // Boost score if context matches
            if (!empty($context)) {
                foreach ($context as $ctxMsg) {
                    if ($ctxMsg['intent'] === $intent['intent_name']) {
                        $score += 0.2; // Context boost
                    }
                }
            }
            
            // Special phrase matching for common questions
            $phrasePatterns = [
                'contact' => ['contact', 'how to contact', 'contact company', 'contact us', 'get in touch', 'reach', 'call', 'phone', 'email', 'where can i contact', 'how do i contact'],
                'about' => ['about', 'what is', 'who are', 'tell me about', 'information about', 'general information', 'about platform', 'about company', 'what does', 'explain'],
                'product_search' => ['find', 'search', 'looking for', 'need', 'want to buy', 'products', 'chicks', 'eggs', 'meat', 'show me', 'available'],
                'order_status' => ['my order', 'order status', 'track', 'tracking', 'where is my order', 'order delivery', 'check order'],
                'account_help' => ['account', 'login', 'register', 'sign up', 'password', 'profile', 'sign in', 'create account', 'creating account', 'how to register', 'how to sign up'],
                'pricing' => ['price', 'cost', 'how much', 'expensive', 'cheap', 'affordable', 'prices'],
                'delivery' => ['delivery', 'deliver', 'shipping', 'when will', 'how long', 'delivery time', 'ship']
            ];
            
            if (isset($phrasePatterns[$intent['intent_name']])) {
                foreach ($phrasePatterns[$intent['intent_name']] as $pattern) {
                    if (stripos($messageLower, $pattern) !== false) {
                        $score += 1.5;
                    }
                }
            }
            
            // Extract question type and match
            $questionType = extractQuestionType($message);
            if ($questionType) {
                $questionIntentMap = [
                    'how' => ['help', 'account_help', 'delivery'],
                    'what' => ['about', 'product_search', 'pricing'],
                    'where' => ['contact', 'delivery'],
                    'when' => ['delivery'],
                    'who' => ['about']
                ];
                
                if (isset($questionIntentMap[$questionType]) && in_array($intent['intent_name'], $questionIntentMap[$questionType])) {
                    $score += 1.0;
                }
            }
            
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestMatch = $intent;
            }
        }
        
        // If score is reasonable, return the match
        if ($bestMatch && $bestScore >= 0.5) {
            return $bestMatch;
        }
        
        // If no match found or very low score, try to match common phrases
        if (!$bestMatch || $bestScore < 0.5) {
            // Try to match common question patterns
            $commonQuestions = [
                'creating account' => 'account_help',
                'create account' => 'account_help',
                'how to create' => 'account_help',
                'how to register' => 'account_help',
                'how do i' => 'help',
                'how can i' => 'help',
                'how to' => 'help',
                'what is' => 'about',
                'who are' => 'about',
                'tell me' => 'about',
                'where can i' => 'help',
                'i need' => 'product_search',
                'i want' => 'product_search',
                'show me' => 'product_search'
            ];
            
            foreach ($commonQuestions as $pattern => $intentName) {
                if (stripos($messageLower, $pattern) !== false) {
                    $stmt = $pdo->prepare("
                        SELECT id, intent_name, keywords, response_template, requires_auth, action_type
                        FROM chat_intents 
                        WHERE intent_name = ? AND is_active = TRUE
                    ");
                    $stmt->execute([$intentName]);
                    $matched = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($matched) {
                        return $matched;
                    }
                }
            }
        }
        
        // If still no match, use default intent
        if (!$bestMatch) {
            $stmt = $pdo->prepare("
                SELECT id, intent_name, keywords, response_template, requires_auth, action_type
                FROM chat_intents 
                WHERE intent_name = 'default'
            ");
            $stmt->execute();
            $bestMatch = $stmt->fetch(PDO::FETCH_ASSOC);
        }
        
        return $bestMatch;
    } catch (PDOException $e) {
        error_log("Error in detectIntent: " . $e->getMessage());
        return null;
    }
}

/**
 * Process intent and generate response
 */
function processIntent($intent, $message, $userId = null, $conversationId = null) {
    global $pdo;
    
    $response = [
        'message' => $intent['response_template'],
        'intent' => $intent['intent_name'],
        'action_type' => $intent['action_type'],
        'quick_replies' => [],
        'data' => null
    ];
    
    // Check if authentication is required
    if ($intent['requires_auth'] && !$userId) {
        $response['message'] = 'Please log in to access this feature. You can log in from the top menu.';
        $response['action_type'] = 'require_auth';
        return $response;
    }
    
    // Handle specific intents
    switch ($intent['intent_name']) {
        case 'contact':
            // Add quick action to visit contact page
            $response['quick_replies'] = [
                ['text' => 'Visit Contact Page', 'action' => 'navigate', 'payload' => ['url' => '/contact']],
                ['text' => 'Send Message', 'action' => 'navigate', 'payload' => ['url' => '/contact']]
            ];
            break;
            
        case 'about':
            // Add quick action to browse products
            $response['quick_replies'] = [
                ['text' => 'Browse Products', 'action' => 'navigate', 'payload' => ['url' => '/products']],
                ['text' => 'Become a Vendor', 'action' => 'navigate', 'payload' => ['url' => '/register']]
            ];
            break;
            
        case 'product_search':
            // Get some sample products
            try {
                $stmt = $pdo->query("
                    SELECT id, name, price, location 
                    FROM products 
                    WHERE is_active = 1 
                    ORDER BY created_at DESC 
                    LIMIT 5
                ");
                $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                if ($products) {
                    $productList = "\n\nHere are some available products:\n";
                    foreach ($products as $product) {
                        $productList .= "• " . $product['name'] . " - KSh " . number_format($product['price'], 2) . " (" . $product['location'] . ")\n";
                    }
                    $response['message'] .= $productList;
                    $response['data'] = ['products' => $products];
                }
            } catch (PDOException $e) {
                error_log("Error fetching products: " . $e->getMessage());
            }
            break;
            
        case 'account_help':
            // Provide detailed help based on message content
            $messageLower = strtolower(trim($message));
            
            // Log for debugging
            error_log("Account help - Message: '$message', Lower: '$messageLower'");
            
            // Check for account creation keywords first (most specific)
            if (stripos($messageLower, 'create') !== false || 
                stripos($messageLower, 'creating') !== false ||
                stripos($messageLower, 'register') !== false || 
                stripos($messageLower, 'registration') !== false ||
                stripos($messageLower, 'sign up') !== false ||
                stripos($messageLower, 'new account') !== false ||
                stripos($messageLower, 'how to create') !== false ||
                stripos($messageLower, 'how do i create') !== false) {
                
                // Detailed account creation instructions
                $response['message'] = "Here's how to create an account on PoultryHubKenya:\n\n📝 Steps to Register:\n\n1. Click on 'Register' button (top right of the page)\n2. Fill in your details:\n   • Full Name\n   • Email Address\n   • Phone Number (optional)\n   • Password\n3. Choose your account type:\n   • Customer - For buying products\n   • Vendor/Farmer - For selling products\n4. Click 'Register'\n5. If registering as a vendor, provide additional details:\n   • Farm Name\n   • Farm Description\n   • Location\n   • ID Number\n\n✅ Once registered, you can:\n• Browse and buy products (as customer)\n• List and sell products (as vendor)\n• Track your orders\n• Manage your profile\n\nNeed help with anything else?";
                $response['quick_replies'] = [
                    ['text' => 'Go to Register Page', 'action' => 'navigate', 'payload' => ['url' => '/register']],
                    ['text' => 'Login Help', 'action' => 'message', 'payload' => ['message' => 'How do I log in?']]
                ];
                error_log("Account help - Returning CREATE ACCOUNT response");
                
            } elseif (stripos($messageLower, 'login') !== false || 
                      stripos($messageLower, 'sign in') !== false ||
                      stripos($messageLower, 'how to login') !== false ||
                      stripos($messageLower, 'how do i login') !== false) {
                
                $response['message'] = "To log in to your account:\n\n1. Click on 'Login' button (top right of the page)\n2. Enter your email and password\n3. Click 'Login'\n\n❓ Forgot your password?\n• Click 'Forgot Password' on the login page\n• Enter your email\n• Check your email for password reset instructions\n\nNeed to create an account? Just click the Register button!";
                $response['quick_replies'] = [
                    ['text' => 'Go to Login Page', 'action' => 'navigate', 'payload' => ['url' => '/login']],
                    ['text' => 'Reset Password', 'action' => 'navigate', 'payload' => ['url' => '/forgot-password']]
                ];
                error_log("Account help - Returning LOGIN response");
                
            } elseif (stripos($messageLower, 'password') !== false || 
                      stripos($messageLower, 'forgot') !== false ||
                      stripos($messageLower, 'reset') !== false) {
                
                $response['message'] = "To reset your password:\n\n1. Go to the Login page\n2. Click 'Forgot Password'\n3. Enter your email address\n4. Check your email for reset instructions\n5. Follow the link to create a new password\n\n📧 Don't see the email?\n• Check your spam folder\n• Make sure you used the correct email\n• Wait a few minutes and try again\n\nNeed more help? Contact our support team!";
                $response['quick_replies'] = [
                    ['text' => 'Reset Password', 'action' => 'navigate', 'payload' => ['url' => '/forgot-password']],
                    ['text' => 'Contact Support', 'action' => 'navigate', 'payload' => ['url' => '/contact']]
                ];
                error_log("Account help - Returning PASSWORD RESET response");
                
            } else {
                // General account help - keep default template but add quick replies
                // Don't override message, use the template from database
                error_log("Account help - Returning GENERAL account help");
            }
            break;
            
        case 'order_status':
            if ($userId) {
                try {
                    $stmt = $pdo->prepare("
                        SELECT o.id, o.status, o.total_amount, o.created_at, 
                               COUNT(oi.id) as item_count
                        FROM orders o
                        LEFT JOIN order_items oi ON o.id = oi.order_id
                        WHERE o.user_id = ?
                        GROUP BY o.id
                        ORDER BY o.created_at DESC
                        LIMIT 5
                    ");
                    $stmt->execute([$userId]);
                    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    
                    if ($orders) {
                        $orderList = "\n\nYour recent orders:\n";
                        foreach ($orders as $order) {
                            $status = ucfirst($order['status']);
                            $date = date('M d, Y', strtotime($order['created_at']));
                            $orderList .= "• Order #" . substr($order['id'], 0, 8) . " - " . $status . " - KSh " . number_format($order['total_amount'], 2) . " (" . $date . ")\n";
                        }
                        $response['message'] .= $orderList;
                        $response['data'] = ['orders' => $orders];
                    } else {
                        $response['message'] = "You don't have any orders yet. Browse our products to place your first order!";
                    }
                } catch (PDOException $e) {
                    error_log("Error fetching orders: " . $e->getMessage());
                }
            }
            break;
    }
    
    // Get quick replies for this intent (only if not already set by switch case)
    if (empty($response['quick_replies'])) {
        try {
            $stmt = $pdo->prepare("
                SELECT text, action, payload
                FROM chat_quick_replies
                WHERE intent_id = ? AND is_active = TRUE
                ORDER BY display_order ASC
            ");
            $stmt->execute([$intent['id']]);
            $quickReplies = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if ($quickReplies) {
                $response['quick_replies'] = array_map(function($reply) {
                    return [
                        'text' => $reply['text'],
                        'action' => $reply['action'],
                        'payload' => json_decode($reply['payload'], true)
                    ];
                }, $quickReplies);
            }
        } catch (PDOException $e) {
            error_log("Error fetching quick replies: " . $e->getMessage());
        }
    }
    
    // Debug logging
    error_log("ProcessIntent response - Intent: {$intent['intent_name']}, Message length: " . strlen($response['message']));
    
    return $response;
}

/**
 * Handle chat message
 */
function handleChatMessage() {
    global $pdo;
    
    $input = json_decode(file_get_contents('php://input'), true);
    $message = sanitizeInput($input['message'] ?? '');
    
    if (empty($message)) {
        http_response_code(400);
        echo json_encode(['error' => 'Message is required']);
        return;
    }
    
    // Get user ID if logged in
    $userId = null;
    $token = getBearerToken();
    if ($token) {
        $payload = validateJWT($token);
        if ($payload) {
            $userId = $payload['user_id'] ?? null;
        }
    }
    
    // Get or create session
    $sessionId = getOrCreateSessionId();
    $conversationId = getOrCreateConversation($sessionId, $userId);
    
    if (!$conversationId) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create conversation']);
        return;
    }
    
    try {
        // Save user message
        $messageId = generateUUID();
        $stmt = $pdo->prepare("
            INSERT INTO chat_messages (id, conversation_id, message, sender, created_at)
            VALUES (?, ?, ?, 'user', NOW())
        ");
        $stmt->execute([$messageId, $conversationId, $message]);
        
        // Detect intent with conversation context for better understanding
        $intent = detectIntent($message, $conversationId);
        
        if (!$intent) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to process message']);
            return;
        }
        
        // Process intent and generate response
        $response = processIntent($intent, $message, $userId, $conversationId);
        
        // Save bot response
        $botMessageId = generateUUID();
        $stmt = $pdo->prepare("
            INSERT INTO chat_messages (id, conversation_id, message, sender, intent, response_type, metadata, created_at)
            VALUES (?, ?, ?, 'bot', ?, ?, ?, NOW())
        ");
        $metadata = json_encode([
            'intent' => $intent['intent_name'],
            'action_type' => $intent['action_type'],
            'data' => $response['data']
        ]);
        $stmt->execute([
            $botMessageId, 
            $conversationId, 
            $response['message'], 
            $intent['intent_name'],
            $intent['action_type'],
            $metadata
        ]);
        
        echo json_encode([
            'success' => true,
            'response' => $response['message'],
            'intent' => $intent['intent_name'],
            'action_type' => $response['action_type'],
            'quick_replies' => $response['quick_replies'],
            'data' => $response['data']
        ]);
        
    } catch (PDOException $e) {
        error_log("Error in handleChatMessage: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to process message']);
    }
}

/**
 * Get chat history
 */
function handleGetChatHistory() {
    global $pdo;
    
    $sessionId = getOrCreateSessionId();
    
    // Get user ID if logged in
    $userId = null;
    $token = getBearerToken();
    if ($token) {
        $payload = validateJWT($token);
        if ($payload) {
            $userId = $payload['user_id'] ?? null;
        }
    }
    
    try {
        $stmt = $pdo->prepare("
            SELECT cm.id, cm.message, cm.sender, cm.intent, cm.created_at
            FROM chat_messages cm
            JOIN chat_conversations cc ON cm.conversation_id = cc.id
            WHERE cc.session_id = ? AND (cc.user_id = ? OR cc.user_id IS NULL)
            ORDER BY cm.created_at ASC
            LIMIT 50
        ");
        $stmt->execute([$sessionId, $userId]);
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'messages' => $messages
        ]);
    } catch (PDOException $e) {
        error_log("Error in handleGetChatHistory: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch chat history']);
    }
}

?>

