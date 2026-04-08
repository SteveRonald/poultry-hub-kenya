<?php
// AI Image Analysis Service
// Uses Google Gemini Vision API for poultry image verification and analysis

require_once __DIR__ . '/GeminiVisionAnalyzer.php';

class ImageAnalyzer {
    private $config;
    private $cache;
    private $geminiAnalyzer;
    
    public function __construct() {
        $this->config = require __DIR__ . '/../../config/ai_config.php';
        $this->cache = [];
        $this->geminiAnalyzer = new GeminiVisionAnalyzer();
    }
    
    /**
     * Analyze image quality and poultry-marketplace relevance using Gemini Vision
     */
    public function analyzeImage($imagePath, $imageUrl = null) {
        // Check if Gemini is enabled
        if (!isset($this->config['services']['gemini']['enabled']) || !$this->config['services']['gemini']['enabled']) {
            return $this->getErrorResponse('Image verification service is disabled.');
        }
        
        // Check cache if enabled
        $cacheKey = md5($imagePath . ($imageUrl ?? ''));
        if (isset($this->cache[$cacheKey])) {
            return $this->cache[$cacheKey];
        }
        
        // Use Gemini Vision for analysis
        try {
            $analysis = $this->geminiAnalyzer->analyzeImage($imagePath, $imageUrl);
            
            // Cache the result if successful
            if ($analysis && !isset($analysis['error'])) {
                $this->cache[$cacheKey] = $analysis;
            }
            
            return $analysis;
            
        } catch (Exception $e) {
            error_log("Image Analysis Error: " . $e->getMessage());
            return $this->getErrorResponse('Failed to analyze image: ' . $e->getMessage());
        }
    }
    
    /**
     * Get error response when analysis fails
     */
    private function getErrorResponse($message) {
        $userFriendlyMessage = 'Image verification service is temporarily unavailable. Please try again later.';

        if (stripos($message, 'quota') !== false || stripos($message, '429') !== false) {
            $userFriendlyMessage = 'Verification limit reached. Please try again in a moment.';
        } elseif (stripos($message, 'config') !== false || stripos($message, 'api key') !== false || stripos($message, 'not configured') !== false) {
            $userFriendlyMessage = 'AI verification is currently unavailable. Please try again later.';
        }

        return [
            'quality_score' => 0,
            'detected_objects' => [],
            'suggestions' => [
                $userFriendlyMessage,
                'We could not confirm the image automatically at the moment.'
            ],
            'inappropriate_content' => false,
            'category_suggestion' => 'Unknown - Requires AI Verification',
            'confidence' => 0.0,
            'is_poultry_related' => false,
            'relevance_status' => 'out_of_scope',
            'analysis_method' => 'error',
            'image_description' => '',
            'rejection_reason' => $userFriendlyMessage,
            'error' => $userFriendlyMessage
        ];
    }
}
?>
