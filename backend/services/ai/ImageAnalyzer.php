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
     * Analyze image quality and content using Gemini Vision
     * Returns analysis with strict poultry verification
     */
    public function analyzeImage($imagePath, $imageUrl = null) {
        // Check if Gemini is enabled
        if (!isset($this->config['services']['gemini']['enabled']) || !$this->config['services']['gemini']['enabled']) {
            return $this->getErrorResponse('Gemini Vision is disabled. Please enable it in the configuration.');
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
        return [
            'quality_score' => 0,
            'detected_objects' => [],
            'suggestions' => [
                '⚠️ ' . $message,
                '❌ Cannot verify if image contains poultry products',
                'Please ensure Gemini API key is configured correctly'
            ],
            'inappropriate_content' => false,
            'category_suggestion' => 'Unknown - Requires AI Verification',
            'confidence' => 0.0,
            'is_poultry_related' => false,
            'analysis_method' => 'error',
            'image_description' => '',
            'rejection_reason' => $message,
            'error' => $message
        ];
    }
}
?>
