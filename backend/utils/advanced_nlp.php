<?php
/**
 * Advanced NLP Utilities for Chatbot
 * Enhanced natural language processing for better intent detection
 */

/**
 * Calculate semantic similarity using multiple algorithms
 */
function calculateSemanticSimilarity($text1, $text2) {
    $text1 = strtolower(trim($text1));
    $text2 = strtolower(trim($text2));
    
    // Exact match
    if ($text1 === $text2) {
        return 1.0;
    }
    
    // Word overlap score
    $words1 = array_unique(explode(' ', $text1));
    $words2 = array_unique(explode(' ', $text2));
    $intersection = count(array_intersect($words1, $words2));
    $union = count(array_unique(array_merge($words1, $words2)));
    $jaccard = $union > 0 ? $intersection / $union : 0;
    
    // Levenshtein distance
    $maxLen = max(strlen($text1), strlen($text2));
    $levenshtein = $maxLen > 0 ? 1 - (levenshtein($text1, $text2) / $maxLen) : 0;
    
    // Substring similarity
    $substringScore = 0;
    $minLen = min(strlen($text1), strlen($text2));
    if ($minLen > 0) {
        $longestCommon = longestCommonSubstring($text1, $text2);
        $substringScore = strlen($longestCommon) / $minLen;
    }
    
    // Weighted combination
    $score = ($jaccard * 0.4) + ($levenshtein * 0.3) + ($substringScore * 0.3);
    
    return min(1.0, max(0.0, $score));
}

/**
 * Find longest common substring
 */
function longestCommonSubstring($str1, $str2) {
    $str1 = strtolower($str1);
    $str2 = strtolower($str2);
    $len1 = strlen($str1);
    $len2 = strlen($str2);
    $longest = '';
    
    for ($i = 0; $i < $len1; $i++) {
        for ($j = $i; $j < $len1; $j++) {
            $substring = substr($str1, $i, $j - $i + 1);
            if (strpos($str2, $substring) !== false && strlen($substring) > strlen($longest)) {
                $longest = $substring;
            }
        }
    }
    
    return $longest;
}

/**
 * Extract key phrases from message
 */
function extractKeyPhrases($message) {
    $message = strtolower(trim($message));
    
    // Remove common stop words
    $stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'];
    
    $words = explode(' ', $message);
    $keyPhrases = [];
    
    // Extract 2-3 word phrases
    for ($i = 0; $i < count($words) - 1; $i++) {
        if (!in_array($words[$i], $stopWords) && !in_array($words[$i + 1], $stopWords)) {
            $keyPhrases[] = $words[$i] . ' ' . $words[$i + 1];
        }
    }
    
    // Extract single important words
    foreach ($words as $word) {
        if (!in_array($word, $stopWords) && strlen($word) > 2) {
            $keyPhrases[] = $word;
        }
    }
    
    return array_unique($keyPhrases);
}

/**
 * Enhanced synonym matching with context
 */
function getEnhancedSynonyms() {
    return [
        'create' => ['make', 'open', 'start', 'set up', 'register', 'sign up', 'join', 'begin', 'establish'],
        'account' => ['profile', 'user', 'member', 'account', 'login', 'sign in'],
        'register' => ['sign up', 'join', 'enroll', 'create account', 'open account', 'become member'],
        'login' => ['sign in', 'log in', 'access', 'enter', 'authenticate'],
        'password' => ['pass', 'pwd', 'secret', 'key', 'code'],
        'product' => ['item', 'goods', 'merchandise', 'stock', 'inventory', 'thing', 'stuff', 'chicken', 'chicks', 'eggs'],
        'order' => ['purchase', 'buy', 'transaction', 'deal', 'purchase order', 'booking'],
        'price' => ['cost', 'amount', 'fee', 'charge', 'payment', 'money', 'rate', 'value'],
        'delivery' => ['shipping', 'ship', 'send', 'dispatch', 'transport', 'deliver', 'send out'],
        'contact' => ['reach', 'call', 'phone', 'email', 'message', 'get in touch', 'connect', 'speak', 'talk', 'reach out'],
        'help' => ['assist', 'support', 'aid', 'guide', 'guide me', 'help me', 'i need help'],
        'about' => ['information', 'details', 'info', 'what', 'who', 'tell me', 'explain', 'describe'],
        'where' => ['location', 'place', 'address', 'site', 'position'],
        'when' => ['time', 'schedule', 'date', 'day', 'hour'],
        'how' => ['way', 'method', 'process', 'steps', 'procedure'],
        'buy' => ['purchase', 'order', 'get', 'acquire', 'obtain'],
        'sell' => ['list', 'offer', 'provide', 'market', 'vend'],
        'available' => ['in stock', 'ready', 'on hand', 'accessible'],
        'chicken' => ['chick', 'poultry', 'bird', 'hen', 'rooster'],
        'egg' => ['eggs', 'poultry eggs', 'chicken eggs'],
        'payment' => ['pay', 'payment method', 'how to pay', 'paying'],
        'track' => ['tracking', 'follow', 'monitor', 'check status', 'where is'],
        'status' => ['state', 'condition', 'progress', 'stage']
    ];
}

/**
 * Match message against intent with enhanced semantic understanding
 */
function enhancedIntentMatching($message, $intentKeywords, $intentName) {
    $message = strtolower(trim($message));
    $keyPhrases = extractKeyPhrases($message);
    $synonyms = getEnhancedSynonyms();
    
    $maxScore = 0;
    $matchedTerms = [];
    
    // Direct keyword matching
    foreach ($intentKeywords as $keyword) {
        $keywordLower = strtolower($keyword);
        
        // Exact match
        if ($message === $keywordLower || in_array($keywordLower, explode(' ', $message))) {
            $maxScore = max($maxScore, 1.0);
            $matchedTerms[] = $keyword;
            continue;
        }
        
        // Substring match
        if (stripos($message, $keywordLower) !== false) {
            $maxScore = max($maxScore, 0.9);
            $matchedTerms[] = $keyword;
            continue;
        }
        
        // Semantic similarity
        $similarity = calculateSemanticSimilarity($message, $keywordLower);
        if ($similarity > 0.6) {
            $maxScore = max($maxScore, $similarity);
            $matchedTerms[] = $keyword;
        }
        
        // Synonym matching
        if (isset($synonyms[$keywordLower])) {
            foreach ($synonyms[$keywordLower] as $synonym) {
                if (stripos($message, $synonym) !== false) {
                    $maxScore = max($maxScore, 0.85);
                    $matchedTerms[] = $keyword;
                    break;
                }
            }
        }
    }
    
    // Key phrase matching
    foreach ($keyPhrases as $phrase) {
        foreach ($intentKeywords as $keyword) {
            $similarity = calculateSemanticSimilarity($phrase, strtolower($keyword));
            if ($similarity > 0.7) {
                $maxScore = max($maxScore, $similarity * 0.9);
                $matchedTerms[] = $keyword;
            }
        }
    }
    
    // Context-based boosting for specific intents
    $contextBoost = getContextBoost($message, $intentName);
    $maxScore = min(1.0, $maxScore + $contextBoost);
    
    return [
        'score' => $maxScore,
        'matched' => array_unique($matchedTerms),
        'confidence' => $maxScore > 0.7 ? 'high' : ($maxScore > 0.5 ? 'medium' : 'low')
    ];
}

/**
 * Get context boost based on question patterns
 */
function getContextBoost($message, $intentName) {
    $boost = 0;
    $messageLower = strtolower($message);
    
    $questionPatterns = [
        'account_help' => ['how do i', 'how can i', 'how to', 'i want to', 'i need to', 'tell me how', 'show me how'],
        'product_search' => ['i want', 'i need', 'looking for', 'search for', 'find', 'show me', 'what do you have'],
        'order_status' => ['my order', 'where is', 'track', 'status of', 'check order'],
        'contact' => ['how to contact', 'where can i', 'phone number', 'email address', 'reach you'],
        'about' => ['what is', 'who are', 'tell me about', 'explain', 'describe'],
        'pricing' => ['how much', 'what is the price', 'cost', 'expensive', 'cheap'],
        'delivery' => ['when will', 'how long', 'delivery time', 'shipping time']
    ];
    
    if (isset($questionPatterns[$intentName])) {
        foreach ($questionPatterns[$intentName] as $pattern) {
            if (stripos($messageLower, $pattern) !== false) {
                $boost += 0.1;
            }
        }
    }
    
    return min(0.2, $boost); // Max 0.2 boost
}

/**
 * Understand user intent with better context
 */
function understandIntent($message, $conversationHistory = []) {
    $message = strtolower(trim($message));
    
    // Check for greetings
    $greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings'];
    foreach ($greetings as $greeting) {
        if (stripos($message, $greeting) === 0 || $message === $greeting) {
            return ['type' => 'greeting', 'confidence' => 0.95];
        }
    }
    
    // Check for questions
    $questionWords = ['what', 'where', 'when', 'why', 'how', 'who', 'which', 'can', 'could', 'would', 'should'];
    $isQuestion = false;
    foreach ($questionWords as $word) {
        if (stripos($message, $word) === 0 || stripos($message, $word . ' ') !== false) {
            $isQuestion = true;
            break;
        }
    }
    
    // Check for commands/requests
    $commandWords = ['show', 'tell', 'give', 'find', 'search', 'help', 'need', 'want'];
    $isCommand = false;
    foreach ($commandWords as $word) {
        if (stripos($message, $word) === 0 || stripos($message, $word . ' ') !== false) {
            $isCommand = true;
            break;
        }
    }
    
    // Analyze conversation history for context
    $contextIntent = null;
    if (!empty($conversationHistory)) {
        $lastIntent = end($conversationHistory);
        if (isset($lastIntent['intent'])) {
            $contextIntent = $lastIntent['intent'];
        }
    }
    
    return [
        'is_question' => $isQuestion,
        'is_command' => $isCommand,
        'context_intent' => $contextIntent,
        'key_phrases' => extractKeyPhrases($message)
    ];
}

/**
 * Generate intelligent response based on context
 * Only enhances if response wasn't already customized
 */
function generateContextualResponse($currentResponse, $message, $conversationHistory = []) {
    $messageLower = strtolower(trim($message));
    $response = $currentResponse;
    
    // Don't modify if response is already detailed (longer than template would be)
    // This indicates it was already customized by processIntent
    if (strlen($response) > 200) {
        // Response was already customized, just add tone enhancements
        if (stripos($messageLower, 'thank') !== false || stripos($messageLower, 'thanks') !== false) {
            $response = "You're welcome! " . $response;
        }
        
        if (stripos($messageLower, 'please') !== false) {
            $response = "Of course! " . $response;
        }
        
        return $response;
    }
    
    // Add context-aware follow-ups for default responses
    if (!empty($conversationHistory)) {
        $lastMessage = end($conversationHistory);
        if (isset($lastMessage['intent']) && $lastMessage['intent'] === 'account_help') {
            // User is asking follow-up question
            $response .= "\n\nIs there anything else you'd like to know about this?";
        }
    }
    
    // Personalize response based on message tone
    if (stripos($messageLower, 'thank') !== false || stripos($messageLower, 'thanks') !== false) {
        $response = "You're welcome! " . $response;
    }
    
    if (stripos($messageLower, 'please') !== false) {
        $response = "Of course! " . $response;
    }
    
    return $response;
}

/**
 * Handle ambiguous queries with clarification
 */
function handleAmbiguousQuery($message, $possibleIntents) {
    if (count($possibleIntents) > 1) {
        $options = [];
        foreach ($possibleIntents as $intent) {
            $options[] = "• " . ucfirst(str_replace('_', ' ', $intent['intent_name']));
        }
        
        return "I found a few possible topics. Could you clarify what you're looking for?\n\n" . implode("\n", $options);
    }
    
    return null;
}

?>

