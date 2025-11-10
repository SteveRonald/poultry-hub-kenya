<?php
/**
 * FAQ Cache Utility
 * Handles caching of frequently asked questions and answers to reduce API calls
 */

require_once __DIR__ . '/../config/database.php';

/**
 * Get cached response for a question
 * @param string $question The user's question
 * @param string $language Language code (en, sw)
 * @return array|null Cached response or null if not found
 */
function getCachedFAQ($question, $language = 'en') {
    global $pdo;
    
    try {
        // Normalize question (lowercase, trim, remove extra spaces)
        $normalizedQuestion = strtolower(trim(preg_replace('/\s+/', ' ', $question)));
        $questionHash = hash('sha256', $normalizedQuestion . $language);
        
        $stmt = $pdo->prepare("
            SELECT answer_text, source, hit_count
            FROM chatbot_faq_cache
            WHERE question_hash = ?
            AND language = ?
            LIMIT 1
        ");
        $stmt->execute([$questionHash, $language]);
        $cached = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($cached) {
            // Update hit count and last_used
            $updateStmt = $pdo->prepare("
                UPDATE chatbot_faq_cache
                SET hit_count = hit_count + 1,
                    last_used = NOW()
                WHERE question_hash = ?
            ");
            $updateStmt->execute([$questionHash]);
            
            error_log("FAQ Cache HIT - Question: " . substr($question, 0, 50) . ", Language: $language, Hits: " . ($cached['hit_count'] + 1));
            
            return [
                'answer' => $cached['answer_text'],
                'source' => $cached['source'],
                'cached' => true
            ];
        }
        
        error_log("FAQ Cache MISS - Question: " . substr($question, 0, 50) . ", Language: $language");
        return null;
        
    } catch (PDOException $e) {
        error_log("Error getting cached FAQ: " . $e->getMessage());
        return null;
    }
}

/**
 * Cache a question and answer
 * @param string $question The user's question
 * @param string $answer The answer
 * @param string $language Language code (en, sw)
 * @param string $source Source of answer (local, openrouter)
 * @return bool Success status
 */
function cacheFAQ($question, $answer, $language = 'en', $source = 'openrouter') {
    global $pdo;
    
    try {
        // Normalize question
        $normalizedQuestion = strtolower(trim(preg_replace('/\s+/', ' ', $question)));
        $questionHash = hash('sha256', $normalizedQuestion . $language);
        
        // Check if already exists
        $checkStmt = $pdo->prepare("
            SELECT id FROM chatbot_faq_cache
            WHERE question_hash = ?
            LIMIT 1
        ");
        $checkStmt->execute([$questionHash]);
        $exists = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($exists) {
            // Update existing cache entry
            $updateStmt = $pdo->prepare("
                UPDATE chatbot_faq_cache
                SET answer_text = ?,
                    source = ?,
                    updated_at = NOW(),
                    last_used = NOW()
                WHERE question_hash = ?
            ");
            $updateStmt->execute([$answer, $source, $questionHash]);
            error_log("FAQ Cache UPDATED - Question: " . substr($question, 0, 50));
        } else {
            // Insert new cache entry
            $insertStmt = $pdo->prepare("
                INSERT INTO chatbot_faq_cache (question_hash, question_text, answer_text, language, source, hit_count)
                VALUES (?, ?, ?, ?, ?, 0)
            ");
            $insertStmt->execute([
                $questionHash,
                substr($normalizedQuestion, 0, 512), // Limit to 512 chars
                $answer,
                $language,
                $source
            ]);
            error_log("FAQ Cache STORED - Question: " . substr($question, 0, 50) . ", Language: $language");
        }
        
        return true;
        
    } catch (PDOException $e) {
        error_log("Error caching FAQ: " . $e->getMessage());
        return false;
    }
}

/**
 * Clean up old cache entries (older than 90 days)
 * @param int $daysOld Days old to delete (default: 90)
 * @return int Number of entries deleted
 */
function cleanupOldCache($daysOld = 90) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("
            DELETE FROM chatbot_faq_cache
            WHERE last_used < DATE_SUB(NOW(), INTERVAL ? DAY)
        ");
        $stmt->execute([$daysOld]);
        $deleted = $stmt->rowCount();
        
        error_log("FAQ Cache CLEANUP - Deleted $deleted old entries (older than $daysOld days)");
        return $deleted;
        
    } catch (PDOException $e) {
        error_log("Error cleaning up cache: " . $e->getMessage());
        return 0;
    }
}

/**
 * Get user's language preference
 * @param int|null $userId User ID (null for guests)
 * @return string Language code (en, sw)
 */
function getUserLanguagePreference($userId = null) {
    global $pdo;
    
    if (!$userId) {
        // Guest users - check session or default to 'en'
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        return $_SESSION['chatbot_language'] ?? 'en';
    }
    
    try {
        $stmt = $pdo->prepare("
            SELECT language_preference
            FROM user_profiles
            WHERE id = ?
            LIMIT 1
        ");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($user && !empty($user['language_preference'])) {
            return $user['language_preference'];
        }
        
        return 'en'; // Default to English
        
    } catch (PDOException $e) {
        error_log("Error getting user language preference: " . $e->getMessage());
        return 'en';
    }
}

/**
 * Update user's language preference
 * @param int $userId User ID
 * @param string $language Language code (en, sw)
 * @return bool Success status
 */
function updateUserLanguagePreference($userId, $language) {
    global $pdo;
    
    // Validate language code
    if (!in_array($language, ['en', 'sw'])) {
        return false;
    }
    
    try {
        $stmt = $pdo->prepare("
            UPDATE user_profiles
            SET language_preference = ?
            WHERE id = ?
        ");
        $stmt->execute([$language, $userId]);
        
        error_log("User language preference UPDATED - User: $userId, Language: $language");
        return true;
        
    } catch (PDOException $e) {
        error_log("Error updating user language preference: " . $e->getMessage());
        return false;
    }
}

/**
 * Check if question is poultry-related
 * @param string $message User's message
 * @return bool True if poultry-related, false otherwise
 */
function isPoultryRelated($message) {
    $messageLower = strtolower(trim($message));
    
    // Poultry-related keywords (English and Kiswahili)
    $poultryKeywords = [
        // English
        'poultry', 'chicken', 'chick', 'hen', 'rooster', 'duck', 'goose', 'turkey',
        'egg', 'eggs', 'broiler', 'layer', 'feed', 'feeding', 'nutrition',
        'disease', 'health', 'vaccination', 'medication', 'breeding', 'hatching',
        'coop', 'cage', 'housing', 'management', 'farming', 'farmer',
        // Kiswahili
        'kuku', 'mayai', 'chakula', 'lishe', 'ugonjwa', 'afya', 'dawa',
        'kienyeji', 'mifugo', 'kukuzwa', 'kuzaa', 'kuku wa kienyeji'
    ];
    
    // Check if message contains poultry keywords
    foreach ($poultryKeywords as $keyword) {
        if (stripos($messageLower, $keyword) !== false) {
            return true;
        }
    }
    
    // Expanded list of non-poultry terms (common unrelated topics)
    $nonPoultryTerms = [
        // Vehicles & Transportation
        'car', 'vehicle', 'tire', 'tyre', 'tired', 'engine', 'brake', 'motor', 'bike', 'bicycle',
        'truck', 'bus', 'airplane', 'plane', 'ship', 'boat',
        // Home & Furniture
        'bed', 'broken', 'furniture', 'chair', 'table', 'sofa', 'couch', 'door', 'window',
        'house', 'home', 'apartment', 'room', 'kitchen', 'bathroom',
        // Electronics & Technology
        'phone', 'computer', 'laptop', 'television', 'tv', 'radio', 'camera',
        // Personal Items
        'shoe', 'shoes', 'clothing', 'clothes', 'shirt', 'pants', 'dress',
        // Other Topics
        'politics', 'weather', 'sports', 'movie', 'music', 'game', 'games',
        'school', 'education', 'job', 'work', 'business', 'money', 'bank',
        'hospital', 'doctor', 'medicine', 'drug', 'cooking', 'recipe', 'food'
    ];
    
    // Check for non-poultry terms - if found, it's likely not poultry-related
    foreach ($nonPoultryTerms as $term) {
        if (stripos($messageLower, $term) !== false) {
            // Double-check: if it also contains poultry terms, it might be related
            $hasPoultryTerm = false;
            foreach ($poultryKeywords as $poultryTerm) {
                if (stripos($messageLower, $poultryTerm) !== false) {
                    $hasPoultryTerm = true;
                    break;
                }
            }
            // If it has non-poultry terms but no poultry terms, it's not poultry-related
            if (!$hasPoultryTerm) {
                return false;
            }
        }
    }
    
    // If message is very short and doesn't contain poultry keywords, assume not poultry-related
    if (strlen($messageLower) < 10) {
        return false;
    }
    
    // Check for common question patterns that are clearly non-poultry
    $nonPoultryPatterns = [
        '/\b(car|vehicle|tire|tyre|tired|engine|brake)\b/i',
        '/\b(bed|furniture|chair|table|sofa|couch)\b/i',
        '/\b(phone|computer|laptop|television|tv)\b/i',
        '/\b(shoe|shoes|clothing|clothes)\b/i',
    ];
    
    foreach ($nonPoultryPatterns as $pattern) {
        if (preg_match($pattern, $messageLower)) {
            // Check if it also mentions poultry
            $hasPoultry = false;
            foreach ($poultryKeywords as $poultryTerm) {
                if (stripos($messageLower, $poultryTerm) !== false) {
                    $hasPoultry = true;
                    break;
                }
            }
            if (!$hasPoultry) {
                return false;
            }
        }
    }
    
    // Default: if we're not sure and message doesn't clearly indicate non-poultry, 
    // let it go through to AI which has better context understanding
    // But if message is clearly about something else, return false
    return false; // Changed default to false - be more strict about what's poultry-related
}

?>

