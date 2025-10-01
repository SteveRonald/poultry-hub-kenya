<?php
// AI Content Moderation Service
// Uses Hugging Face Transformers (free) and basic PHP validation

class ContentModerator {
    private $config;
    private $cache;
    
    public function __construct() {
        $this->config = require __DIR__ . '/../../config/ai_config.php';
        $this->cache = [];
    }
    
    /**
     * Moderate product content (name, description, images)
     */
    public function moderateContent($productName, $description, $imageAnalysis = null) {
        $moderation = [
            'is_approved' => true,
            'confidence' => 1.0,
            'issues' => [],
            'suggestions' => [],
            'moderation_method' => 'basic'
        ];
        
        try {
            // Basic validation first
            $basicValidation = $this->basicContentValidation($productName, $description);
            $moderation = array_merge($moderation, $basicValidation);
            
            // AI-powered moderation if enabled
            if ($this->config['services']['hugging_face']['enabled']) {
                $aiModeration = $this->aiContentModeration($productName, $description);
                if ($aiModeration) {
                    $moderation = array_merge($moderation, $aiModeration);
                    $moderation['moderation_method'] = 'ai_enhanced';
                }
            }
            
            // Image moderation
            if ($imageAnalysis) {
                $imageModeration = $this->moderateImage($imageAnalysis);
                $moderation = array_merge($moderation, $imageModeration);
            }
            
            // Final approval decision
            $moderation['is_approved'] = $this->makeApprovalDecision($moderation);
            
        } catch (Exception $e) {
            error_log("Content Moderation Error: " . $e->getMessage());
            $moderation['issues'][] = 'Moderation system error - manual review required';
            $moderation['is_approved'] = false;
        }
        
        return $moderation;
    }
    
    /**
     * Basic content validation
     */
    private function basicContentValidation($productName, $description) {
        $issues = [];
        $suggestions = [];
        
        // Product name validation
        if (empty(trim($productName))) {
            $issues[] = 'Product name is required';
        } elseif (strlen($productName) < 2) {
            $issues[] = 'Product name is too short';
        } elseif (strlen($productName) > 100) {
            $issues[] = 'Product name is too long';
        }
        
        // Description validation
        if (empty(trim($description))) {
            $issues[] = 'Product description is required';
        } elseif (strlen($description) < 10) {
            $issues[] = 'Product description is too short';
        } elseif (strlen($description) > 1000) {
            $issues[] = 'Product description is too long';
        }
        
        // Check for inappropriate words
        $inappropriateWords = $this->getInappropriateWords();
        $textToCheck = strtolower($productName . ' ' . $description);
        
        foreach ($inappropriateWords as $word) {
            if (strpos($textToCheck, $word) !== false) {
                $issues[] = "Content contains inappropriate language";
                break;
            }
        }
        
        // Check for spam patterns
        if ($this->isSpamContent($productName, $description)) {
            $issues[] = 'Content appears to be spam';
        }
        
        // Check for contact information in description
        if ($this->containsContactInfo($description)) {
            $issues[] = 'Description should not contain contact information';
            $suggestions[] = 'Remove phone numbers, emails, or social media links from description';
        }
        
        // Check for excessive capitalization
        if ($this->hasExcessiveCapitalization($productName . ' ' . $description)) {
            $suggestions[] = 'Avoid excessive use of capital letters';
        }
        
        return [
            'issues' => $issues,
            'suggestions' => $suggestions
        ];
    }
    
    /**
     * AI-powered content moderation
     */
    private function aiContentModeration($productName, $description) {
        $text = $productName . ' ' . $description;
        
        // Use Hugging Face toxicity detection
        $model = $this->config['services']['hugging_face']['models']['content_moderation'];
        $url = "https://api-inference.huggingface.co/models/$model";
        
        $data = [
            'inputs' => $text
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . ($this->config['services']['hugging_face']['api_key'] ?? '')
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            error_log("Hugging Face Moderation API Error: HTTP $httpCode - $response");
            return null;
        }
        
        $result = json_decode($response, true);
        if (!$result || !is_array($result)) {
            return null;
        }
        
        $moderation = [
            'issues' => [],
            'suggestions' => [],
            'confidence' => 0.8
        ];
        
        // Process toxicity results
        foreach ($result as $label) {
            if (isset($label['label']) && isset($label['score'])) {
                $labelName = $label['label'];
                $score = $label['score'];
                
                if ($score > 0.7) { // High confidence threshold
                    switch ($labelName) {
                        case 'TOXIC':
                        case 'SEVERE_TOXIC':
                            $moderation['issues'][] = 'Content contains toxic language';
                            break;
                        case 'THREAT':
                            $moderation['issues'][] = 'Content contains threatening language';
                            break;
                        case 'INSULT':
                            $moderation['issues'][] = 'Content contains insulting language';
                            break;
                        case 'IDENTITY_HATE':
                            $moderation['issues'][] = 'Content contains hate speech';
                            break;
                    }
                }
            }
        }
        
        return $moderation;
    }
    
    /**
     * Moderate image content
     */
    private function moderateImage($imageAnalysis) {
        $issues = [];
        $suggestions = [];
        
        if (isset($imageAnalysis['inappropriate_content']) && $imageAnalysis['inappropriate_content']) {
            $issues[] = 'Image contains inappropriate content';
        }
        
        if (isset($imageAnalysis['quality_score']) && $imageAnalysis['quality_score'] < 3) {
            $issues[] = 'Image quality is too low';
            $suggestions[] = 'Please upload a clearer, higher quality image';
        }
        
        if (isset($imageAnalysis['suggestions']) && !empty($imageAnalysis['suggestions'])) {
            $suggestions = array_merge($suggestions, $imageAnalysis['suggestions']);
        }
        
        return [
            'issues' => $issues,
            'suggestions' => $suggestions
        ];
    }
    
    /**
     * Make final approval decision
     */
    private function makeApprovalDecision($moderation) {
        // If there are critical issues, don't approve
        $criticalIssues = [
            'Content contains inappropriate language',
            'Content contains toxic language',
            'Content contains threatening language',
            'Content contains insulting language',
            'Content contains hate speech',
            'Image contains inappropriate content',
            'Content appears to be spam'
        ];
        
        foreach ($moderation['issues'] as $issue) {
            if (in_array($issue, $criticalIssues)) {
                return false;
            }
        }
        
        // If too many issues, don't approve
        if (count($moderation['issues']) > 3) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Get list of inappropriate words
     */
    private function getInappropriateWords() {
        return [
            'spam', 'scam', 'fake', 'fraud',
            'free money', 'get rich', 'click here',
            'buy now', 'limited time', 'act now',
            'call now', 'text me', 'whatsapp',
            'dm me', 'contact me', 'call me'
        ];
    }
    
    /**
     * Check if content is spam
     */
    private function isSpamContent($productName, $description) {
        $spamPatterns = [
            '/\b(click here|buy now|limited time|act now)\b/i',
            '/\b(free money|get rich|make money)\b/i',
            '/\b(call now|text me|whatsapp|dm me)\b/i',
            '/\$\d+/', // Multiple dollar signs
            '/!{3,}/', // Multiple exclamation marks
            '/[A-Z]{5,}/' // Excessive capitalization
        ];
        
        $text = $productName . ' ' . $description;
        
        foreach ($spamPatterns as $pattern) {
            if (preg_match($pattern, $text)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check if content contains contact information
     */
    private function containsContactInfo($description) {
        $contactPatterns = [
            '/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/', // Phone numbers
            '/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/', // Email addresses
            '/\b(facebook|instagram|twitter|linkedin|whatsapp)\b/i', // Social media
            '/\b(www\.|http:\/\/|https:\/\/)/i' // URLs
        ];
        
        foreach ($contactPatterns as $pattern) {
            if (preg_match($pattern, $description)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check for excessive capitalization
     */
    private function hasExcessiveCapitalization($text) {
        $words = explode(' ', $text);
        $capitalizedWords = 0;
        
        foreach ($words as $word) {
            if (strlen($word) > 2 && strtoupper($word) === $word) {
                $capitalizedWords++;
            }
        }
        
        return $capitalizedWords > count($words) * 0.3; // More than 30% capitalized
    }
    
    /**
     * Get moderation summary
     */
    public function getModerationSummary($moderation) {
        $summary = [
            'status' => $moderation['is_approved'] ? 'approved' : 'needs_review',
            'confidence' => $moderation['confidence'],
            'issue_count' => count($moderation['issues']),
            'suggestion_count' => count($moderation['suggestions']),
            'method' => $moderation['moderation_method']
        ];
        
        if (!empty($moderation['issues'])) {
            $summary['critical_issues'] = array_filter($moderation['issues'], function($issue) {
                return in_array($issue, [
                    'Content contains inappropriate language',
                    'Content contains toxic language',
                    'Image contains inappropriate content',
                    'Content appears to be spam'
                ]);
            });
        }
        
        return $summary;
    }
}
?>

