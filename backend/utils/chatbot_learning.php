<?php
/**
 * Chatbot Learning System
 * Allows the chatbot to learn from user interactions and improve over time
 */

require_once __DIR__ . '/../config/database.php';

/**
 * Record a successful intent match for learning
 */
function recordSuccessfulMatch($conversationId, $userMessage, $intentName, $confidenceScore, $matchMethod) {
    global $pdo;
    
    try {
        $id = generateUUID();
        $stmt = $pdo->prepare("
            INSERT INTO chatbot_match_history 
            (id, conversation_id, user_message, intent_matched, confidence_score, match_method, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([$id, $conversationId, $userMessage, $intentName, $confidenceScore, $matchMethod]);
        
        // Update learned patterns
        updateLearnedPatterns($userMessage, $intentName, true);
        
        return true;
    } catch (PDOException $e) {
        error_log("Error recording successful match: " . $e->getMessage());
        // Return true to not break chatbot if learning fails
        return true;
    }
}

/**
 * Record user feedback on a chatbot response
 */
function recordFeedback($messageId, $conversationId, $userId, $feedbackType, $userCorrection = null, $expectedIntent = null) {
    global $pdo;
    
    try {
        $id = generateUUID();
        
        // Get the matched intent from the message
        $stmt = $pdo->prepare("SELECT intent FROM chat_messages WHERE id = ?");
        $stmt->execute([$messageId]);
        $message = $stmt->fetch(PDO::FETCH_ASSOC);
        $intentMatched = $message['intent'] ?? null;
        
        $stmt = $pdo->prepare("
            INSERT INTO chatbot_feedback 
            (id, message_id, conversation_id, user_id, feedback_type, user_correction, intent_matched, expected_intent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            $id, 
            $messageId, 
            $conversationId, 
            $userId, 
            $feedbackType, 
            $userCorrection, 
            $intentMatched,
            $expectedIntent
        ]);
        
        // If negative feedback, update learning
        if ($feedbackType === 'negative' || $feedbackType === 'correction') {
            learnFromFeedback($userMessage, $intentMatched, $expectedIntent, $userCorrection);
        }
        
        // If positive feedback, strengthen the pattern
        if ($feedbackType === 'positive') {
            $stmt = $pdo->prepare("SELECT message FROM chat_messages WHERE conversation_id = ? AND sender = 'user' ORDER BY created_at DESC LIMIT 1");
            $stmt->execute([$conversationId]);
            $userMsg = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($userMsg) {
                updateLearnedPatterns($userMsg['message'], $intentMatched, true);
            }
        }
        
        return $id;
    } catch (PDOException $e) {
        error_log("Error recording feedback: " . $e->getMessage());
        return false;
    }
}

/**
 * Learn from user feedback and corrections
 */
function learnFromFeedback($userMessage, $wrongIntent, $correctIntent, $correction = null) {
    global $pdo;
    
    try {
        // Decrease confidence in wrong pattern
        if ($wrongIntent && !empty($userMessage)) {
            $messageSubstring = substr($userMessage, 0, 50);
            $stmt = $pdo->prepare("
                UPDATE chatbot_learned_patterns 
                SET success_count = GREATEST(0, success_count - 1),
                    success_rate = (GREATEST(0, success_count - 1) / GREATEST(1, match_count)) * 100,
                    updated_at = NOW()
                WHERE intent_name = ? 
                AND pattern_text LIKE ?
                AND is_active = TRUE
            ");
            $stmt->execute([$wrongIntent, "%" . $messageSubstring . "%"]);
        }
        
        // Increase confidence in correct pattern
        if ($correctIntent && !empty($userMessage)) {
            updateLearnedPatterns($userMessage, $correctIntent, true);
            
            // Add as training example (skip if duplicate key error)
            try {
                $stmt = $pdo->prepare("
                    INSERT INTO chatbot_training_examples 
                    (id, user_message, correct_intent, source, is_verified, created_at)
                    VALUES (?, ?, ?, 'feedback', TRUE, NOW())
                ");
                $exampleId = generateUUID();
                $stmt->execute([$exampleId, $userMessage, $correctIntent]);
            } catch (PDOException $e) {
                // Ignore duplicate key errors
                if (strpos($e->getMessage(), 'Duplicate') === false) {
                    error_log("Error adding training example: " . $e->getMessage());
                }
            }
        }
        
        // Learn synonyms from correction
        if ($correction && !empty($userMessage)) {
            extractAndLearnSynonyms($userMessage, $correction, $correctIntent);
        }
        
        return true;
    } catch (PDOException $e) {
        error_log("Error learning from feedback: " . $e->getMessage());
        return false;
    }
}

/**
 * Update learned patterns based on successful matches
 */
function updateLearnedPatterns($userMessage, $intentName, $isSuccess) {
    global $pdo;
    
    try {
        if (empty($userMessage) || empty($intentName)) {
            return false;
        }
        
        $messageLower = strtolower(trim($userMessage));
        $words = explode(' ', $messageLower);
        
        // Extract key phrases (2-3 word combinations)
        $phrases = [];
        for ($i = 0; $i < count($words) - 1; $i++) {
            $phrases[] = $words[$i] . ' ' . $words[$i + 1];
            if ($i < count($words) - 2) {
                $phrases[] = $words[$i] . ' ' . $words[$i + 1] . ' ' . $words[$i + 2];
            }
        }
        
        // Update or insert patterns
        foreach ($phrases as $phrase) {
            if (strlen($phrase) > 3 && strlen($phrase) < 100) {
                $stmt = $pdo->prepare("
                    INSERT INTO chatbot_learned_patterns 
                    (id, intent_name, pattern_text, pattern_type, match_count, success_count, success_rate, is_active, created_at)
                    VALUES (?, ?, ?, 'phrase', 1, ?, 100.00, TRUE, NOW())
                    ON DUPLICATE KEY UPDATE
                        match_count = match_count + 1,
                        success_count = success_count + ?,
                        success_rate = (success_count / match_count) * 100,
                        updated_at = NOW()
                ");
                $id = generateUUID();
                $successIncrement = $isSuccess ? 1 : 0;
                $stmt->execute([$id, $intentName, $phrase, $successIncrement, $successIncrement]);
            }
        }
        
        // Update single keywords
        foreach ($words as $word) {
            if (strlen($word) > 2 && strlen($word) < 50) {
                $stmt = $pdo->prepare("
                    INSERT INTO chatbot_learned_patterns 
                    (id, intent_name, pattern_text, pattern_type, match_count, success_count, success_rate, is_active, created_at)
                    VALUES (?, ?, ?, 'keyword', 1, ?, 100.00, TRUE, NOW())
                    ON DUPLICATE KEY UPDATE
                        match_count = match_count + 1,
                        success_count = success_count + ?,
                        success_rate = (success_count / match_count) * 100,
                        updated_at = NOW()
                ");
                $id = generateUUID();
                $successIncrement = $isSuccess ? 1 : 0;
                $stmt->execute([$id, $intentName, $word, $successIncrement, $successIncrement]);
            }
        }
        
        return true;
    } catch (PDOException $e) {
        error_log("Error updating learned patterns: " . $e->getMessage());
        return false;
    }
}

/**
 * Get learned patterns for an intent (boost matching)
 */
function getLearnedPatterns($intentName = null) {
    global $pdo;
    
    try {
        if ($intentName) {
            $stmt = $pdo->prepare("
                SELECT pattern_text, pattern_type, success_rate, match_count
                FROM chatbot_learned_patterns
                WHERE intent_name = ? AND is_active = TRUE
                ORDER BY success_rate DESC, match_count DESC
                LIMIT 50
            ");
            $stmt->execute([$intentName]);
        } else {
            $stmt = $pdo->query("
                SELECT intent_name, pattern_text, pattern_type, success_rate, match_count
                FROM chatbot_learned_patterns
                WHERE is_active = TRUE
                ORDER BY success_rate DESC, match_count DESC
                LIMIT 100
            ");
        }
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        error_log("Error getting learned patterns: " . $e->getMessage());
        return [];
    }
}

/**
 * Extract and learn synonyms from user corrections
 */
function extractAndLearnSynonyms($originalMessage, $correction, $intentContext) {
    global $pdo;
    
    try {
        $originalWords = explode(' ', strtolower($originalMessage));
        $correctionWords = explode(' ', strtolower($correction));
        
        // Find words that are different but in similar positions
        for ($i = 0; $i < min(count($originalWords), count($correctionWords)); $i++) {
            if ($originalWords[$i] !== $correctionWords[$i] && 
                strlen($originalWords[$i]) > 2 && 
                strlen($correctionWords[$i]) > 2) {
                
                // Learn bidirectional synonym
                $stmt = $pdo->prepare("
                    INSERT INTO chatbot_learned_synonyms 
                    (id, base_word, synonym, intent_context, usage_count, success_rate, is_active, created_at)
                    VALUES (?, ?, ?, ?, 1, 100.00, TRUE, NOW())
                    ON DUPLICATE KEY UPDATE
                        usage_count = usage_count + 1,
                        success_rate = (success_rate + 100.00) / 2,
                        updated_at = NOW()
                ");
                $id1 = generateUUID();
                $id2 = generateUUID();
                $stmt->execute([$id1, $originalWords[$i], $correctionWords[$i], $intentContext]);
                $stmt->execute([$id2, $correctionWords[$i], $originalWords[$i], $intentContext]);
            }
        }
        
        return true;
    } catch (PDOException $e) {
        error_log("Error extracting synonyms: " . $e->getMessage());
        return false;
    }
}

/**
 * Get learned synonyms for a word
 */
function getLearnedSynonyms($word, $intentContext = null) {
    global $pdo;
    
    try {
        if ($intentContext) {
            $stmt = $pdo->prepare("
                SELECT synonym, usage_count, success_rate
                FROM chatbot_learned_synonyms
                WHERE base_word = ? 
                AND (intent_context = ? OR intent_context IS NULL)
                AND is_active = TRUE
                ORDER BY success_rate DESC, usage_count DESC
                LIMIT 10
            ");
            $stmt->execute([strtolower($word), $intentContext]);
        } else {
            $stmt = $pdo->prepare("
                SELECT synonym, usage_count, success_rate
                FROM chatbot_learned_synonyms
                WHERE base_word = ? AND is_active = TRUE
                ORDER BY success_rate DESC, usage_count DESC
                LIMIT 10
            ");
            $stmt->execute([strtolower($word)]);
        }
        
        return array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'synonym');
    } catch (PDOException $e) {
        error_log("Error getting learned synonyms: " . $e->getMessage());
        return [];
    }
}

/**
 * Add training example manually (admin function)
 */
function addTrainingExample($userMessage, $correctIntent, $correctResponse = null, $source = 'admin') {
    global $pdo;
    
    try {
        $id = generateUUID();
        $stmt = $pdo->prepare("
            INSERT INTO chatbot_training_examples 
            (id, user_message, correct_intent, correct_response, source, is_verified, created_at)
            VALUES (?, ?, ?, ?, ?, TRUE, NOW())
        ");
        $stmt->execute([$id, $userMessage, $correctIntent, $correctResponse, $source]);
        
        // Immediately update learned patterns
        updateLearnedPatterns($userMessage, $correctIntent, true);
        
        return $id;
    } catch (PDOException $e) {
        error_log("Error adding training example: " . $e->getMessage());
        return false;
    }
}

/**
 * Get chatbot learning statistics
 */
function getLearningStatistics() {
    global $pdo;
    
    try {
        $stats = [];
        
        // Total matches
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM chatbot_match_history");
        $stats['total_matches'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Total feedback
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM chatbot_feedback");
        $stats['total_feedback'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Positive feedback rate
        $stmt = $pdo->query("
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN feedback_type = 'positive' THEN 1 ELSE 0 END) as positive
            FROM chatbot_feedback
        ");
        $fb = $stmt->fetch(PDO::FETCH_ASSOC);
        $stats['positive_feedback_rate'] = $fb['total'] > 0 ? ($fb['positive'] / $fb['total']) * 100 : 0;
        
        // Learned patterns
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM chatbot_learned_patterns WHERE is_active = TRUE");
        $stats['learned_patterns'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Learned synonyms
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM chatbot_learned_synonyms WHERE is_active = TRUE");
        $stats['learned_synonyms'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Training examples
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM chatbot_training_examples");
        $stats['training_examples'] = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Average confidence score
        $stmt = $pdo->query("SELECT AVG(confidence_score) as avg FROM chatbot_match_history");
        $stats['avg_confidence'] = $stmt->fetch(PDO::FETCH_ASSOC)['avg'] ?? 0;
        
        return $stats;
    } catch (PDOException $e) {
        error_log("Error getting learning statistics: " . $e->getMessage());
        return [];
    }
}

/**
 * Generate UUID - check if function exists first
 */
if (!function_exists('generateUUID')) {
    function generateUUID() {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}

?>

