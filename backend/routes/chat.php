<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/security.php';
require_once __DIR__ . '/../utils/chat_helpers.php';
require_once __DIR__ . '/../utils/advanced_nlp.php';
require_once __DIR__ . '/../utils/chatbot_learning.php';

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
function getOrCreateConversation($sessionId, $userId = null, $conversationId = null) {
    global $pdo;
    
    try {
        // If specific conversation ID provided (for switching conversations)
        if ($conversationId) {
            // For logged-in users: only allow if user_id matches (strict ownership)
            // For non-logged-in users: allow if session_id matches
            if ($userId) {
                $stmt = $pdo->prepare("
                    SELECT id FROM chat_conversations 
                    WHERE id = ? AND user_id = ?
                ");
                $stmt->execute([$conversationId, $userId]);
            } else {
                $stmt = $pdo->prepare("
                    SELECT id FROM chat_conversations 
                    WHERE id = ? AND session_id = ? AND user_id IS NULL
                ");
                $stmt->execute([$conversationId, $sessionId]);
            }
            $conversation = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($conversation) {
                return $conversation['id'];
            }
        }
        
        // If user is logged in, look for their active conversation first
        if ($userId) {
            $stmt = $pdo->prepare("
                SELECT id FROM chat_conversations 
                WHERE user_id = ? AND status = 'active'
                ORDER BY last_message_at DESC, created_at DESC LIMIT 1
            ");
            $stmt->execute([$userId]);
            $conversation = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($conversation) {
                return $conversation['id'];
            }
        }
        
        // Try to find active conversation by session
        $stmt = $pdo->prepare("
            SELECT id FROM chat_conversations 
            WHERE session_id = ? AND status = 'active'
            ORDER BY created_at DESC LIMIT 1
        ");
        $stmt->execute([$sessionId]);
        $conversation = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($conversation) {
            // Update user_id if user logged in (link session conversation to user account)
            if ($userId) {
                // Only update if conversation doesn't already have a user_id (avoid overwriting)
                $updateStmt = $pdo->prepare("
                    UPDATE chat_conversations 
                    SET user_id = ? 
                    WHERE id = ? AND (user_id IS NULL OR user_id = ?)
                ");
                $updateStmt->execute([$userId, $conversation['id'], $userId]);
            }
            return $conversation['id'];
        }
        
        // Create new conversation
        $newConversationId = generateUUID();
        $stmt = $pdo->prepare("
            INSERT INTO chat_conversations (id, user_id, session_id, status, language, title, last_message_at, message_count)
            VALUES (?, ?, ?, 'active', 'en', NULL, NOW(), 0)
        ");
        $stmt->execute([$newConversationId, $userId, $sessionId]);
        
        return $newConversationId;
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
        // This must come FIRST before general account_help matching
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
        
        // Check for password reset specifically
        $passwordPatterns = ['password', 'forgot password', 'reset password', 'change password', 'lost password'];
        foreach ($passwordPatterns as $pattern) {
            if (stripos($messageLower, $pattern) !== false && stripos($messageLower, 'create') === false && stripos($messageLower, 'register') === false) {
                $stmt = $pdo->prepare("
                    SELECT id, intent_name, keywords, response_template, requires_auth, action_type
                    FROM chat_intents 
                    WHERE intent_name = 'account_help' AND is_active = TRUE
                ");
                $stmt->execute();
                $accountIntent = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($accountIntent) {
                    error_log("Quick match: Password reset intent detected for message: '$message'");
                    return $accountIntent;
                }
            }
        }
        
        // Check for login specifically
        $loginPatterns = ['login', 'sign in', 'log in', 'how to login', 'how do i login'];
        foreach ($loginPatterns as $pattern) {
            if (stripos($messageLower, $pattern) !== false && stripos($messageLower, 'create') === false && stripos($messageLower, 'register') === false) {
                $stmt = $pdo->prepare("
                    SELECT id, intent_name, keywords, response_template, requires_auth, action_type
                    FROM chat_intents 
                    WHERE intent_name = 'account_help' AND is_active = TRUE
                ");
                $stmt->execute();
                $accountIntent = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($accountIntent) {
                    error_log("Quick match: Login intent detected for message: '$message'");
                    return $accountIntent;
                }
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
        
        // Get learned patterns for boosting
        $learnedPatterns = [];
        try {
            $learnedPatterns = getLearnedPatterns();
        } catch (Exception $e) {
            error_log("Warning: Could not load learned patterns: " . $e->getMessage());
            // Continue without learned patterns if there's an error
        }
        
        $bestMatch = null;
        $bestScore = 0;
        $possibleMatches = [];
        
        foreach ($intents as $intent) {
            $keywords = json_decode($intent['keywords'], true) ?? [];
            
            // Use advanced semantic matching (from advanced_nlp.php)
            $matchResult = enhancedIntentMatching($message, $keywords, $intent['intent_name']);
            $score = $matchResult['score'];
            
            // Boost score with learned patterns (if available)
            if (!empty($learnedPatterns)) {
                foreach ($learnedPatterns as $pattern) {
                    if (isset($pattern['intent_name']) && $pattern['intent_name'] === $intent['intent_name']) {
                        $patternText = strtolower($pattern['pattern_text'] ?? '');
                        $messageLower = strtolower($message);
                        if (!empty($patternText) && stripos($messageLower, $patternText) !== false) {
                            // Boost based on success rate
                            $successRate = floatval($pattern['success_rate'] ?? 0);
                            $boost = ($successRate / 100) * 0.2; // Max 0.2 boost
                            $score += $boost;
                        }
                    }
                }
            }
            
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
            
            // Collect possible matches for ambiguous queries
            if ($score > 0.5 && $score < 0.8) {
                $possibleMatches[] = $intent;
            }
        }
        
        // Handle ambiguous queries
        if ($bestScore < 0.7 && count($possibleMatches) > 1) {
            $clarification = handleAmbiguousQuery($message, $possibleMatches);
            if ($clarification) {
                // Return a clarification response
                $defaultIntent = $pdo->query("SELECT * FROM chat_intents WHERE intent_name = 'default'")->fetch(PDO::FETCH_ASSOC);
                if ($defaultIntent) {
                    $defaultIntent['response_template'] = $clarification;
                    return $defaultIntent;
                }
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
            // Enhanced product search with keyword extraction
            try {
                $keyPhrases = extractKeyPhrases($message);
                $searchTerms = [];
                
                // Extract product-related terms
                $productTerms = ['chick', 'chicken', 'egg', 'meat', 'feed', 'poultry'];
                foreach ($keyPhrases as $phrase) {
                    foreach ($productTerms as $term) {
                        if (stripos($phrase, $term) !== false) {
                            $searchTerms[] = $term;
                        }
                    }
                }
                
                // Build search query
                $query = "
                    SELECT id, name, price, location, category, description
                    FROM products 
                    WHERE is_active = 1 
                ";
                
                if (!empty($searchTerms)) {
                    $placeholders = [];
                    $params = [];
                    foreach ($searchTerms as $term) {
                        $placeholders[] = "(name LIKE ? OR description LIKE ? OR category LIKE ?)";
                        $searchPattern = "%{$term}%";
                        $params[] = $searchPattern;
                        $params[] = $searchPattern;
                        $params[] = $searchPattern;
                    }
                    $query .= " AND (" . implode(" OR ", $placeholders) . ")";
                }
                
                $query .= " ORDER BY created_at DESC LIMIT 10";
                
                $stmt = $pdo->prepare($query);
                if (!empty($searchTerms)) {
                    $stmt->execute($params);
                } else {
                    $stmt->execute();
                }
                $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                if ($products) {
                    $productList = "\n\nHere are some products that match your search:\n";
                    foreach ($products as $product) {
                        $productList .= "• " . $product['name'] . " - KSh " . number_format($product['price'], 2) . " (" . $product['location'] . ")\n";
                    }
                    $response['message'] .= $productList;
                    $response['data'] = ['products' => $products];
                } else {
                    $response['message'] .= "\n\nI couldn't find products matching your search. Would you like to browse all available products?";
                    $response['quick_replies'] = [
                        ['text' => 'Browse All Products', 'action' => 'navigate', 'payload' => ['url' => '/products']],
                        ['text' => 'Search Again', 'action' => 'message', 'payload' => ['message' => 'What products are you looking for?']]
                    ];
                }
            } catch (PDOException $e) {
                error_log("Error fetching products: " . $e->getMessage());
            }
            break;
            
        case 'account_help':
            // Provide detailed help based on message content
            $messageLower = strtolower(trim($message));
            $customized = false;
            
            // Log for debugging
            error_log("Account help - Message: '$message', Lower: '$messageLower'");
            
            // Check for account creation keywords first (most specific) - PRIORITY 1
            $createPatterns = ['create', 'creating', 'register', 'registration', 'sign up', 'new account', 'how to create', 'how do i create', 'make account', 'open account'];
            foreach ($createPatterns as $pattern) {
                if (stripos($messageLower, $pattern) !== false) {
                    // Detailed account creation instructions
                    $response['message'] = "Here's how to create an account on PoultryHubKenya:\n\n📝 Steps to Register:\n\n1. Click on 'Register' button (top right of the page)\n2. Fill in your details:\n   • Full Name\n   • Email Address\n   • Phone Number (optional)\n   • Password\n3. Choose your account type:\n   • Customer - For buying products\n   • Vendor/Farmer - For selling products\n4. Click 'Register'\n5. If registering as a vendor, provide additional details:\n   • Farm Name\n   • Farm Description\n   • Location\n   • ID Number\n\n✅ Once registered, you can:\n• Browse and buy products (as customer)\n• List and sell products (as vendor)\n• Track your orders\n• Manage your profile\n\nNeed help with anything else?";
                    $response['quick_replies'] = [
                        ['text' => 'Go to Register Page', 'action' => 'navigate', 'payload' => ['url' => '/register']],
                        ['text' => 'Login Help', 'action' => 'message', 'payload' => ['message' => 'How do I log in?']]
                    ];
                    $customized = true;
                    error_log("Account help - Returning CREATE ACCOUNT response for pattern: '$pattern'");
                    break;
                }
            }
            
            // Check for login keywords - PRIORITY 2 (only if not creation)
            if (!$customized) {
                $loginPatterns = ['login', 'sign in', 'log in', 'how to login', 'how do i login', 'signing in'];
                foreach ($loginPatterns as $pattern) {
                    if (stripos($messageLower, $pattern) !== false) {
                        $response['message'] = "To log in to your account:\n\n1. Click on 'Login' button (top right of the page)\n2. Enter your email and password\n3. Click 'Login'\n\n❓ Forgot your password?\n• Click 'Forgot Password' on the login page\n• Enter your email\n• Check your email for password reset instructions\n\nNeed to create an account? Just click the Register button!";
                        $response['quick_replies'] = [
                            ['text' => 'Go to Login Page', 'action' => 'navigate', 'payload' => ['url' => '/login']],
                            ['text' => 'Reset Password', 'action' => 'navigate', 'payload' => ['url' => '/forgot-password']]
                        ];
                        $customized = true;
                        error_log("Account help - Returning LOGIN response for pattern: '$pattern'");
                        break;
                    }
                }
            }
            
            // Check for password reset keywords - PRIORITY 3 (only if not creation or login)
            if (!$customized) {
                $passwordPatterns = ['password', 'forgot', 'reset', 'change password', 'lost password', 'can\'t login', 'cannot login'];
                foreach ($passwordPatterns as $pattern) {
                    if (stripos($messageLower, $pattern) !== false) {
                        $response['message'] = "To reset your password:\n\n1. Go to the Login page\n2. Click 'Forgot Password'\n3. Enter your email address\n4. Check your email for reset instructions\n5. Follow the link to create a new password\n\n📧 Don't see the email?\n• Check your spam folder\n• Make sure you used the correct email\n• Wait a few minutes and try again\n\nNeed more help? Contact our support team!";
                        $response['quick_replies'] = [
                            ['text' => 'Reset Password', 'action' => 'navigate', 'payload' => ['url' => '/forgot-password']],
                            ['text' => 'Contact Support', 'action' => 'navigate', 'payload' => ['url' => '/contact']]
                        ];
                        $customized = true;
                        error_log("Account help - Returning PASSWORD RESET response for pattern: '$pattern'");
                        break;
                    }
                }
            }
            
            // If still not customized, use default template (will have quick replies from database)
            if (!$customized) {
                error_log("Account help - Using default template for message: '$message'");
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
    // SECURITY: Check if quick_replies is empty OR null to prevent overriding custom replies
    if (empty($response['quick_replies']) || count($response['quick_replies']) === 0) {
        try {
            $stmt = $pdo->prepare("
                SELECT text, action, payload
                FROM chat_quick_replies
                WHERE intent_id = ? AND is_active = TRUE
                ORDER BY display_order ASC
            ");
            $stmt->execute([$intent['id']]);
            $quickReplies = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if ($quickReplies && empty($response['quick_replies'])) {
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
    
    // Debug logging - log the actual response that will be sent
    error_log("ProcessIntent FINAL - Intent: {$intent['intent_name']}, Message length: " . strlen($response['message']) . ", Quick replies: " . count($response['quick_replies']));
    
    return $response;
}

/**
 * Handle chat message
 */
function handleChatMessage() {
    global $pdo;
    
    $input = json_decode(file_get_contents('php://input'), true);
    $message = sanitizeInput($input['message'] ?? '');
    
    // Get conversation ID - validate but don't HTML encode UUIDs
    $requestedConversationId = isset($input['conversation_id']) ? trim($input['conversation_id']) : null;
    if ($requestedConversationId && !preg_match('/^[a-zA-Z0-9_-]+$/', $requestedConversationId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid conversation ID format']);
        return;
    }
    
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
    $conversationId = getOrCreateConversation($sessionId, $userId, $requestedConversationId);
    
    if (!$conversationId) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create conversation']);
        return;
    }
    
    // CRITICAL SECURITY CHECK: For logged-in users, verify conversation ownership
    // This prevents users from accessing other users' conversations even if they know the ID
    if ($userId && $conversationId) {
        $verifyStmt = $pdo->prepare("
            SELECT user_id FROM chat_conversations 
            WHERE id = ?
        ");
        $verifyStmt->execute([$conversationId]);
        $verifyConv = $verifyStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($verifyConv) {
            // If conversation exists but belongs to different user, deny access
            if ($verifyConv['user_id'] !== null && $verifyConv['user_id'] !== $userId) {
                http_response_code(403);
                echo json_encode(['error' => 'Access denied: This conversation belongs to another user']);
                return;
            }
            
            // If conversation exists but has no user_id, assign it to current user (if logged in)
            if ($verifyConv['user_id'] === null && $userId) {
                $updateStmt = $pdo->prepare("
                    UPDATE chat_conversations 
                    SET user_id = ? 
                    WHERE id = ? AND user_id IS NULL
                ");
                $updateStmt->execute([$userId, $conversationId]);
            }
        }
    }
    
    try {
        // Save user message
        $messageId = generateUUID();
        $stmt = $pdo->prepare("
            INSERT INTO chat_messages (id, conversation_id, message, sender, created_at)
            VALUES (?, ?, ?, 'user', NOW())
        ");
        $stmt->execute([$messageId, $conversationId, $message]);
        
        // Update conversation metadata (title, last_message_at, message_count)
        // Set title from first user message if not set
        try {
            // Check if columns exist first
            $columnCheck = $pdo->query("SHOW COLUMNS FROM chat_conversations LIKE 'title'");
            if ($columnCheck->rowCount() > 0) {
                $updateStmt = $pdo->prepare("
                    UPDATE chat_conversations 
                    SET last_message_at = NOW(),
                        message_count = message_count + 1,
                        title = CASE 
                            WHEN title IS NULL OR title = '' THEN SUBSTRING(?, 1, 50)
                            ELSE title
                        END
                    WHERE id = ?
                ");
                $updateStmt->execute([$message, $conversationId]);
            } else {
                // Columns don't exist, try simpler update
                $updateStmt = $pdo->prepare("
                    UPDATE chat_conversations 
                    SET updated_at = NOW()
                    WHERE id = ?
                ");
                $updateStmt->execute([$conversationId]);
            }
        } catch (PDOException $e) {
            error_log("Warning: Could not update conversation metadata: " . $e->getMessage());
            // Continue even if metadata update fails
        }
        
        // Get conversation history for context
        $conversationHistory = [];
        if ($conversationId) {
            try {
                $stmt = $pdo->prepare("
                    SELECT message, sender, intent
                    FROM chat_messages
                    WHERE conversation_id = ?
                    ORDER BY created_at DESC
                    LIMIT 5
                ");
                $stmt->execute([$conversationId]);
                $conversationHistory = array_reverse($stmt->fetchAll(PDO::FETCH_ASSOC));
            } catch (PDOException $e) {
                error_log("Error fetching conversation history: " . $e->getMessage());
            }
        }
        
        // Understand user intent with advanced NLP
        $intentAnalysis = understandIntent($message, $conversationHistory);
        
        // Detect intent with conversation context for better understanding
        $intent = detectIntent($message, $conversationId);
        
        if (!$intent) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to process message']);
            return;
        }
        
        // Process intent and generate response with context
        $response = processIntent($intent, $message, $userId, $conversationId);
        
        // Log before contextual enhancement
        error_log("Before contextual enhancement - Message length: " . strlen($response['message']) . ", Intent: {$intent['intent_name']}");
        
        // Enhance response with contextual understanding (only if not already customized)
        $originalMessage = $response['message'];
        $enhancedMessage = generateContextualResponse($response['message'], $message, $conversationHistory);
        $response['message'] = $enhancedMessage;
        
        // Log after contextual enhancement
        error_log("After contextual enhancement - Message length: " . strlen($response['message']));
        
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
        
        // Update conversation last_message_at and message_count
        $updateStmt = $pdo->prepare("
            UPDATE chat_conversations 
            SET last_message_at = NOW(),
                message_count = message_count + 1
            WHERE id = ?
        ");
        $updateStmt->execute([$conversationId]);
        
        // Record successful match for learning
        try {
            recordSuccessfulMatch(
                $conversationId, 
                $message, 
                $intent['intent_name'], 
                0.8, // Default confidence score (will be improved with learning)
                'enhanced_nlp'
            );
        } catch (Exception $e) {
            // Log but don't fail the request if learning system has issues
            error_log("Error recording match for learning: " . $e->getMessage());
        }
        
        // Final log before sending response
        $finalResponse = [
            'success' => true,
            'response' => $response['message'], // Make sure we're sending the correct message
            'intent' => $intent['intent_name'],
            'action_type' => $response['action_type'] ?? null,
            'quick_replies' => $response['quick_replies'] ?? [],
            'data' => $response['data'] ?? null,
            'message_id' => $botMessageId, // Include message ID for feedback
            'conversation_id' => $conversationId
        ];
        
        error_log("Sending response to frontend - Message length: " . strlen($finalResponse['response']) . ", Quick replies: " . count($finalResponse['quick_replies']));
        error_log("Response preview: " . substr($finalResponse['response'], 0, 100) . "...");
        
        echo json_encode($finalResponse);
        
    } catch (PDOException $e) {
        error_log("Error in handleChatMessage: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to process message. Please try again.',
            'debug' => getenv('APP_ENV') === 'development' ? $e->getMessage() : null
        ]);
    } catch (Exception $e) {
        error_log("General error in handleChatMessage: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'An unexpected error occurred. Please try again.',
            'debug' => getenv('APP_ENV') === 'development' ? $e->getMessage() : null
        ]);
    }
}

/**
 * Get chat history for a conversation
 */
function handleGetChatHistory() {
    global $pdo;
    
    // Get conversation ID - don't sanitize UUIDs with HTML encoding
    $conversationId = isset($_GET['conversation_id']) ? trim($_GET['conversation_id']) : '';
    // Validate UUID format
    if ($conversationId && !preg_match('/^[a-zA-Z0-9_-]+$/', $conversationId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid conversation ID format']);
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
    
    // SECURITY: Validate and sanitize session ID to prevent injection
    $sessionId = getOrCreateSessionId();
    
    try {
        // If conversation ID provided, get messages for that conversation
        if ($conversationId) {
            // Strict access control: logged-in users must own the conversation (user_id match)
            // Non-logged-in users can only access conversations with matching session_id and no user_id
            if ($userId) {
                // For logged-in users: require user_id match (strict ownership)
                $stmt = $pdo->prepare("
                    SELECT id, user_id, session_id 
                    FROM chat_conversations 
                    WHERE id = ? AND user_id = ?
                ");
                $stmt->execute([$conversationId, $userId]);
            } else {
                // For non-logged-in users: only allow if session_id matches and no user_id
                // SECURITY: Only proceed if session ID is valid
                if ($sessionId) {
                    $stmt = $pdo->prepare("
                        SELECT id, user_id, session_id 
                        FROM chat_conversations 
                        WHERE id = ? AND session_id = ? AND user_id IS NULL
                    ");
                    $stmt->execute([$conversationId, $sessionId]);
                } else {
                    // Invalid session ID - deny access
                    http_response_code(403);
                    echo json_encode(['error' => 'Invalid session']);
                    return;
                }
            }
            
            $conversation = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($conversation) {
                $stmt = $pdo->prepare("
                    SELECT id, message, sender, intent, created_at
                    FROM chat_messages
                    WHERE conversation_id = ?
                    ORDER BY created_at ASC
                ");
                $stmt->execute([$conversationId]);
                $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                echo json_encode([
                    'success' => true,
                    'messages' => $messages,
                    'conversation_id' => $conversationId
                ]);
                return;
            } else {
                http_response_code(403);
                echo json_encode(['error' => 'Access denied to this conversation']);
                return;
            }
        }
        
        // Fallback: Get messages for current session/user
        if ($userId) {
            // For logged-in users: only show conversations they own
            $stmt = $pdo->prepare("
                SELECT cm.id, cm.message, cm.sender, cm.intent, cm.created_at, cm.conversation_id
                FROM chat_messages cm
                JOIN chat_conversations cc ON cm.conversation_id = cc.id
                WHERE cc.user_id = ?
                ORDER BY cm.created_at ASC
                LIMIT 50
            ");
            $stmt->execute([$userId]);
        } else {
            // For non-logged-in users: only show session conversations
            $stmt = $pdo->prepare("
                SELECT cm.id, cm.message, cm.sender, cm.intent, cm.created_at, cm.conversation_id
                FROM chat_messages cm
                JOIN chat_conversations cc ON cm.conversation_id = cc.id
                WHERE cc.session_id = ? AND cc.user_id IS NULL
                ORDER BY cm.created_at ASC
                LIMIT 50
            ");
            $stmt->execute([$sessionId]);
        }
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'messages' => $messages
        ]);
    } catch (PDOException $e) {
        error_log("Error in handleGetChatHistory: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        http_response_code(500);
        echo json_encode([
            'error' => 'Failed to fetch chat history',
            'debug' => getenv('APP_ENV') === 'development' ? $e->getMessage() : null
        ]);
    }
}

/**
 * Get list of user's conversations
 */
function handleGetConversations() {
    global $pdo;
    
    // Get user ID - must be logged in
    $userId = null;
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    
    $userId = $payload['user_id'] ?? null;
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['error' => 'User ID not found']);
        return;
    }
    
    try {
        // Get all conversations for this user, ordered by last message
        $stmt = $pdo->prepare("
            SELECT 
                c.id,
                c.title,
                c.status,
                c.created_at,
                c.last_message_at,
                c.message_count,
                (SELECT message FROM chat_messages 
                 WHERE conversation_id = c.id 
                 ORDER BY created_at DESC LIMIT 1) as last_message
            FROM chat_conversations c
            WHERE c.user_id = ?
            ORDER BY c.last_message_at DESC, c.created_at DESC
            LIMIT 50
        ");
        $stmt->execute([$userId]);
        $conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format conversations
        $formattedConversations = array_map(function($conv) {
            return [
                'id' => $conv['id'],
                'title' => $conv['title'] ?: 'New Conversation',
                'status' => $conv['status'],
                'created_at' => $conv['created_at'],
                'last_message_at' => $conv['last_message_at'],
                'message_count' => intval($conv['message_count']),
                'last_message' => $conv['last_message'] ? substr($conv['last_message'], 0, 100) : null
            ];
        }, $conversations);
        
        echo json_encode([
            'success' => true,
            'conversations' => $formattedConversations
        ]);
    } catch (PDOException $e) {
        error_log("Error in handleGetConversations: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch conversations']);
    }
}

/**
 * Create a new conversation
 */
function handleCreateConversation() {
    global $pdo;
    
    // Get user ID - must be logged in
    $userId = null;
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    
    $userId = $payload['user_id'] ?? null;
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['error' => 'User ID not found']);
        return;
    }
    
    try {
        $conversationId = generateUUID();
        // SECURITY: Use validated session ID function instead of direct cookie access
        $sessionId = getOrCreateSessionId();
        
        $stmt = $pdo->prepare("
            INSERT INTO chat_conversations (id, user_id, session_id, status, language, title, last_message_at, message_count)
            VALUES (?, ?, ?, 'active', 'en', 'New Conversation', NOW(), 0)
        ");
        $stmt->execute([$conversationId, $userId, $sessionId]);
        
        echo json_encode([
            'success' => true,
            'conversation_id' => $conversationId,
            'message' => 'New conversation created'
        ]);
    } catch (PDOException $e) {
        error_log("Error in handleCreateConversation: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create conversation']);
    }
}

?>

