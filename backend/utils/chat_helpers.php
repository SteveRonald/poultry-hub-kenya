<?php
/**
 * Chat Helper Functions
 * Provides utilities for better intent detection and natural language understanding
 */

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function calculateSimilarity($str1, $str2) {
    $str1 = strtolower($str1);
    $str2 = strtolower($str2);
    
    if ($str1 === $str2) {
        return 1.0;
    }
    
    $len1 = strlen($str1);
    $len2 = strlen($str2);
    
    if ($len1 === 0 || $len2 === 0) {
        return 0.0;
    }
    
    $maxLen = max($len1, $len2);
    $distance = levenshtein($str1, $str2);
    
    return 1 - ($distance / $maxLen);
}

/**
 * Get synonyms for common words
 */
function getSynonyms() {
    return [
        'contact' => ['reach', 'call', 'phone', 'email', 'message', 'get in touch', 'connect', 'speak', 'talk'],
        'product' => ['item', 'goods', 'merchandise', 'stock', 'inventory', 'thing', 'stuff'],
        'order' => ['purchase', 'buy', 'transaction', 'deal', 'purchase order'],
        'help' => ['assist', 'support', 'aid', 'guide', 'guide me'],
        'about' => ['information', 'details', 'info', 'what', 'who', 'tell me'],
        'price' => ['cost', 'amount', 'fee', 'charge', 'payment', 'money'],
        'delivery' => ['shipping', 'ship', 'send', 'dispatch', 'transport'],
        'account' => ['profile', 'login', 'sign in', 'register', 'sign up'],
        'company' => ['business', 'firm', 'organization', 'platform', 'service'],
        'how' => ['way', 'method', 'process', 'steps'],
        'where' => ['location', 'place', 'address'],
        'when' => ['time', 'schedule', 'date']
    ];
}

/**
 * Expand message with synonyms for better matching
 */
function expandWithSynonyms($message, $synonyms) {
    $words = explode(' ', strtolower($message));
    $expanded = [$message];
    
    foreach ($words as $word) {
        foreach ($synonyms as $key => $synonymList) {
            if (in_array($word, $synonymList)) {
                // Replace word with key and add variations
                foreach ($synonymList as $syn) {
                    $expanded[] = str_replace($word, $syn, $message);
                }
            }
        }
    }
    
    return array_unique($expanded);
}

/**
 * Extract intent from message using fuzzy matching
 */
function fuzzyMatchIntent($message, $keywords, $threshold = 0.6) {
    $messageLower = strtolower($message);
    $words = explode(' ', $messageLower);
    $synonyms = getSynonyms();
    
    $maxScore = 0;
    $matchedKeywords = [];
    
    foreach ($keywords as $keyword) {
        $keywordLower = strtolower($keyword);
        
        // Exact match
        if ($messageLower === $keywordLower || in_array($keywordLower, $words)) {
            $maxScore = max($maxScore, 1.0);
            $matchedKeywords[] = $keyword;
            continue;
        }
        
        // Check if keyword is in message
        if (stripos($messageLower, $keywordLower) !== false) {
            $maxScore = max($maxScore, 0.9);
            $matchedKeywords[] = $keyword;
            continue;
        }
        
        // Word-level similarity
        foreach ($words as $word) {
            $similarity = calculateSimilarity($word, $keywordLower);
            if ($similarity >= $threshold) {
                $maxScore = max($maxScore, $similarity);
                $matchedKeywords[] = $keyword;
            }
        }
        
        // Synonym matching
        if (isset($synonyms[$keywordLower])) {
            foreach ($synonyms[$keywordLower] as $synonym) {
                if (stripos($messageLower, $synonym) !== false || in_array($synonym, $words)) {
                    $maxScore = max($maxScore, 0.85);
                    $matchedKeywords[] = $keyword;
                    break;
                }
            }
        }
    }
    
    return ['score' => $maxScore, 'matched' => array_unique($matchedKeywords)];
}

/**
 * Normalize message for better matching
 */
function normalizeMessage($message) {
    // Remove extra spaces
    $message = preg_replace('/\s+/', ' ', trim($message));
    
    // Remove common punctuation (but keep important ones)
    $message = preg_replace('/[^\w\s?]/', '', $message);
    
    // Convert to lowercase
    $message = strtolower($message);
    
    return $message;
}

/**
 * Extract question type from message
 */
function extractQuestionType($message) {
    $questionWords = [
        'how' => ['how do', 'how can', 'how to', 'how does', 'how is', 'how are'],
        'what' => ['what is', 'what are', 'what do', 'what does', 'what can'],
        'where' => ['where is', 'where are', 'where can', 'where do'],
        'when' => ['when is', 'when are', 'when can', 'when do'],
        'why' => ['why is', 'why are', 'why do', 'why does'],
        'who' => ['who is', 'who are', 'who do', 'who does']
    ];
    
    $messageLower = strtolower($message);
    
    foreach ($questionWords as $type => $patterns) {
        foreach ($patterns as $pattern) {
            if (stripos($messageLower, $pattern) === 0 || stripos($messageLower, $pattern) !== false) {
                return $type;
            }
        }
    }
    
    return null;
}

/**
 * Check if message is asking about contact information
 */
function isContactQuestion($message) {
    $contactPatterns = [
        'contact', 'reach', 'call', 'phone', 'email', 'address', 'location',
        'get in touch', 'speak', 'talk', 'connect', 'message', 'how to reach',
        'where are you', 'where is your office', 'phone number', 'email address'
    ];
    
    $messageLower = strtolower($message);
    
    foreach ($contactPatterns as $pattern) {
        if (stripos($messageLower, $pattern) !== false) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if message is asking about platform/company information
 */
function isAboutQuestion($message) {
    $aboutPatterns = [
        'what is', 'who are', 'tell me about', 'about', 'information about',
        'what do you do', 'what does', 'who is', 'explain', 'describe',
        'general information', 'platform information', 'company information'
    ];
    
    $messageLower = strtolower($message);
    
    foreach ($aboutPatterns as $pattern) {
        if (stripos($messageLower, $pattern) !== false) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if message is asking for products
 */
function isProductQuestion($message) {
    $productPatterns = [
        'product', 'products', 'buy', 'purchase', 'item', 'items', 'available',
        'have', 'sell', 'offer', 'stock', 'chicks', 'eggs', 'meat', 'chicken',
        'find', 'search', 'looking for', 'need', 'want', 'show me'
    ];
    
    $messageLower = strtolower($message);
    
    foreach ($productPatterns as $pattern) {
        if (stripos($messageLower, $pattern) !== false) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if message is asking about account creation specifically
 */
function isAccountCreationQuestion($message) {
    $creationPatterns = [
        'create', 'creating', 'register', 'registration', 'sign up', 'new account',
        'how to create', 'how do i create', 'how to register', 'how do i register',
        'make account', 'open account', 'set up account'
    ];
    
    $messageLower = strtolower(trim($message));
    
    // Don't match just "account" alone
    if (trim($messageLower) === 'account') {
        return false;
    }
    
    foreach ($creationPatterns as $pattern) {
        if (stripos($messageLower, $pattern) !== false) {
            return true;
        }
    }
    
    return false;
}

/**
 * Get context from previous messages
 */
function getContextFromHistory($conversationId, $pdo, $limit = 3) {
    try {
        $stmt = $pdo->prepare("
            SELECT message, sender, intent
            FROM chat_messages
            WHERE conversation_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        ");
        $stmt->execute([$conversationId, $limit]);
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        return array_reverse($messages); // Return in chronological order
    } catch (PDOException $e) {
        error_log("Error getting context: " . $e->getMessage());
        return [];
    }
}
?>

