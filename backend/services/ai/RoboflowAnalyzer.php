<?php
// Roboflow AI Integration for Custom Poultry Detection
require_once __DIR__ . '/../../config/ai_config.php';

class RoboflowAnalyzer {
    private $config;
    private $apiKey;
    private $projectId;
    private $modelVersion;
    
    public function __construct() {
        $this->config = require __DIR__ . '/../../config/ai_config.php';
        $this->apiKey = $this->config['services']['roboflow']['api_key'] ?? '';
        $this->projectId = $this->config['services']['roboflow']['project_id'] ?? '';
        $this->modelVersion = $this->config['services']['roboflow']['model_version'] ?? '1';
    }
    
    /**
     * Analyze image using custom Roboflow model
     */
    public function analyzeImage($imagePath, $imageUrl = null) {
        if (empty($this->apiKey) || empty($this->projectId)) {
            return $this->fallbackAnalysis($imagePath);
        }
        
        try {
            // Use URL if provided, otherwise use local file
            $imageSource = $imageUrl ?: $imagePath;
            
            if ($imageUrl) {
                $result = $this->predictFromUrl($imageUrl);
            } else {
                $result = $this->predictFromFile($imagePath);
            }
            
            if ($result) {
                return $this->processRoboflowResult($result, $imagePath);
            }
            
        } catch (Exception $e) {
            error_log("Roboflow API Error: " . $e->getMessage());
        }
        
        return $this->fallbackAnalysis($imagePath);
    }
    
    /**
     * Predict from image URL
     */
    private function predictFromUrl($imageUrl) {
        $url = "https://detect.roboflow.com/{$this->projectId}/{$this->modelVersion}";
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'api_key' => $this->apiKey,
            'image' => $imageUrl
        ]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode === 200) {
            return json_decode($response, true);
        }
        
        return null;
    }
    
    /**
     * Predict from local file
     */
    private function predictFromFile($imagePath) {
        if (!file_exists($imagePath)) {
            return null;
        }
        
        $url = "https://detect.roboflow.com/{$this->projectId}/{$this->modelVersion}";
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, [
            'api_key' => $this->apiKey,
            'image' => new CURLFile($imagePath)
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode === 200) {
            return json_decode($response, true);
        }
        
        return null;
    }
    
    /**
     * Process Roboflow prediction results (STRICT MODE)
     */
    private function processRoboflowResult($result, $imagePath) {
        $detectedObjects = [];
        $confidence = 0;
        $isPoultry = false;
        $category = 'Other';
        $minConfidence = 0.6; // STRICT: Require 60% confidence minimum
        
        if (isset($result['predictions']) && is_array($result['predictions'])) {
            foreach ($result['predictions'] as $prediction) {
                if (isset($prediction['class']) && isset($prediction['confidence'])) {
                    $className = strtolower($prediction['class']);
                    $conf = $prediction['confidence'];
                    
                    // STRICT: Only accept high-confidence predictions
                    if ($conf >= $minConfidence) {
                        $detectedObjects[] = $className;
                        $confidence = max($confidence, $conf);
                        
                        // Check if it's poultry-related (STRICT)
                        if ($this->isPoultryClass($className)) {
                            $isPoultry = true;
                            $category = $this->getCategoryFromClass($className);
                        }
                    }
                }
            }
        }
        
        // STRICT: If no high-confidence poultry detections, reject
        if (!$isPoultry || $confidence < $minConfidence) {
            $isPoultry = false;
            $category = 'Rejected - Not Poultry';
        }
        
        return [
            'quality_score' => $this->calculateQualityScore($confidence, count($detectedObjects)),
            'detected_objects' => array_unique($detectedObjects),
            'suggestions' => $this->generateSuggestions($confidence, $detectedObjects),
            'inappropriate_content' => false,
            'category_suggestion' => $category,
            'confidence' => $confidence,
            'is_poultry_related' => $isPoultry,
            'analysis_method' => 'roboflow_custom',
            'raw_predictions' => $result['predictions'] ?? []
        ];
    }
    
    /**
     * Check if detected class is poultry-related (STRICT MODE)
     * Only accept what the custom model was trained on
     */
    private function isPoultryClass($className) {
        // STRICT: Only accept classes your custom model was trained on
        $trainedClasses = [
            'chicken', 'hen', 'rooster', 'chick', 'duck', 'goose', 'turkey',
            'egg', 'eggs', 'feed', 'grain', 'seed', 'corn', 'wheat',
            'poultry_meat', 'chicken_meat', 'cooked_chicken',
            'cage', 'coop', 'nest', 'feeder', 'waterer',
            'poultry_equipment', 'farming_equipment'
        ];
        
        $className = strtolower(trim($className));
        
        // Exact match or contains match with trained classes
        foreach ($trainedClasses as $trainedClass) {
            if ($className === $trainedClass || strpos($className, $trainedClass) !== false) {
                return true;
            }
        }
        
        // STRICT: If not in trained classes, reject
        return false;
    }
    
    /**
     * Get category from detected class
     */
    private function getCategoryFromClass($className) {
        $livePoultry = ['chicken', 'hen', 'rooster', 'chick', 'duck', 'goose', 'turkey'];
        $eggs = ['egg', 'eggs'];
        $meat = ['poultry_meat', 'chicken_meat', 'cooked_chicken', 'meat'];
        $feed = ['feed', 'grain', 'seed', 'corn', 'wheat'];
        $equipment = ['cage', 'coop', 'nest', 'feeder', 'waterer', 'equipment'];
        
        foreach ($livePoultry as $class) {
            if (strpos($className, $class) !== false) {
                return 'Live Poultry';
            }
        }
        
        foreach ($eggs as $class) {
            if (strpos($className, $class) !== false) {
                return 'Eggs';
            }
        }
        
        foreach ($meat as $class) {
            if (strpos($className, $class) !== false) {
                return 'Poultry Meat';
            }
        }
        
        foreach ($feed as $class) {
            if (strpos($className, $class) !== false) {
                return 'Feed & Nutrition';
            }
        }
        
        foreach ($equipment as $class) {
            if (strpos($className, $class) !== false) {
                return 'Equipment';
            }
        }
        
        return 'Live Poultry'; // Default
    }
    
    /**
     * Calculate quality score based on confidence and detections
     */
    private function calculateQualityScore($confidence, $objectCount) {
        $score = 5; // Base score
        
        // Higher confidence = better quality
        if ($confidence > 0.8) {
            $score += 3;
        } elseif ($confidence > 0.6) {
            $score += 2;
        } elseif ($confidence > 0.4) {
            $score += 1;
        }
        
        // More objects detected = better quality
        if ($objectCount > 3) {
            $score += 1;
        } elseif ($objectCount > 1) {
            $score += 0.5;
        }
        
        return min($score, 10);
    }
    
    /**
     * Generate suggestions based on results (STRICT MODE)
     */
    private function generateSuggestions($confidence, $detectedObjects) {
        $suggestions = [];
        
        if ($confidence < 0.6) {
            $suggestions[] = '⚠️ Low confidence detection - image may not be poultry-related';
            $suggestions[] = 'Please upload a clear image of chickens, eggs, feed, or poultry equipment';
            $suggestions[] = 'Try taking the photo in better lighting with the product clearly visible';
        }
        
        if (empty($detectedObjects)) {
            $suggestions[] = '❌ No poultry-related objects detected';
            $suggestions[] = 'This image does not appear to contain poultry products';
            $suggestions[] = 'Please upload images of chickens, eggs, feed, or poultry equipment only';
        } else {
            $suggestions[] = '✅ Great! AI detected: ' . implode(', ', $detectedObjects);
            
            if ($confidence > 0.8) {
                $suggestions[] = '🎯 Excellent image quality and detection!';
            } elseif ($confidence > 0.6) {
                $suggestions[] = '👍 Good detection - image is poultry-related';
            }
        }
        
        return $suggestions;
    }
    
    /**
     * Fallback analysis when Roboflow is not available (STRICT MODE)
     */
    private function fallbackAnalysis($imagePath) {
        $filename = basename($imagePath);
        
        return [
            'quality_score' => 3, // Lower score for fallback
            'detected_objects' => [],
            'suggestions' => [
                '⚠️ Custom AI not available - using basic analysis',
                '❌ Cannot verify if image contains poultry products',
                'Please set up Roboflow custom AI for accurate detection',
                'Upload only poultry-related images (chickens, eggs, feed, equipment)'
            ],
            'inappropriate_content' => false,
            'category_suggestion' => 'Unknown - Requires AI Verification',
            'confidence' => 0.3, // Low confidence for fallback
            'is_poultry_related' => false, // STRICT: Assume not poultry without AI
            'analysis_method' => 'fallback_strict'
        ];
    }
}
?>
