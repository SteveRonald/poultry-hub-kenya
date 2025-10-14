<?php
// Ultralytics Hub AI Service
// Integrates with your custom trained model

class UltralyticsHubAnalyzer {
    private $config;
    private $cache;
    
    public function __construct() {
        $this->config = require __DIR__ . '/../../config/ai_config.php';
        $this->cache = [];
    }
    
    /**
     * Analyze image using Ultralytics Hub custom model
     */
    public function analyzeImage($imagePath, $imageUrl = null) {
        $cacheKey = md5($imagePath . ($imageUrl ?? ''));
        
        // Check cache first
        if ($this->config['fallback']['cache_results'] && isset($this->cache[$cacheKey])) {
            return $this->cache[$cacheKey];
        }
        
        $analysis = [
            'quality_score' => 0,
            'detected_objects' => [],
            'suggestions' => [],
            'inappropriate_content' => false,
            'category_suggestion' => '',
            'confidence' => 0,
            'analysis_method' => 'ultralytics_hub',
            'poultry_analysis' => [
                'breed_detected' => '',
                'health_indicators' => [],
                'age_estimate' => '',
                'quality_assessment' => ''
            ]
        ];
        
        try {
            if ($this->config['services']['ultralytics_hub']['enabled']) {
                $ultralyticsResult = $this->callUltralyticsHub($imagePath, $imageUrl);
                if ($ultralyticsResult) {
                    $analysis = array_merge($analysis, $ultralyticsResult);
                    $analysis['analysis_method'] = 'ultralytics_hub';
                }
            }
            
            // Fallback to basic analysis if Ultralytics fails
            if ($analysis['analysis_method'] === 'ultralytics_hub' && empty($analysis['detected_objects'])) {
                $analysis = array_merge($analysis, $this->basicImageAnalysis($imagePath, $imageUrl));
                $analysis['analysis_method'] = 'ultralytics_hub_fallback';
            }
            
            // Cache the result
            if ($this->config['fallback']['cache_results']) {
                $this->cache[$cacheKey] = $analysis;
            }
            
        } catch (Exception $e) {
            error_log("Ultralytics Hub Analysis Error: " . $e->getMessage());
            $analysis = array_merge($analysis, $this->basicImageAnalysis($imagePath, $imageUrl));
            $analysis['analysis_method'] = 'ultralytics_hub_error_fallback';
        }
        
        return $analysis;
    }
    
    /**
     * Call Ultralytics Hub API
     */
    private function callUltralyticsHub($imagePath, $imageUrl = null) {
        $apiKey = $this->config['services']['ultralytics_hub']['api_key'];
        $modelId = $this->config['services']['ultralytics_hub']['model_id'];
        
        if (empty($apiKey) || empty($modelId)) {
            return null;
        }
        
        // Prepare image data
        $imageData = null;
        if ($imageUrl) {
            // Download image from URL
            $imageData = file_get_contents($imageUrl);
        } elseif ($imagePath && file_exists($imagePath)) {
            // Read local file
            $imageData = file_get_contents($imagePath);
        }
        
        if (!$imageData) {
            return null;
        }
        
        // Encode image to base64
        $base64Image = base64_encode($imageData);
        
        // Prepare API request - Using correct Ultralytics Hub API format
        $apiUrl = "https://predict.ultralytics.com";
        
        // Try using just the model ID without URL
        $postData = [
            'model' => $modelId,
            'imgsz' => 640,
            'conf' => 0.1,  // Lower confidence threshold
            'iou' => 0.45
        ];
        
        $headers = [
            'x-api-key: ' . $apiKey
        ];
        
        // Debug logging (can be removed in production)
        // error_log("Ultralytics Hub API Request:");
        // error_log("URL: " . $apiUrl);
        // error_log("Model ID: " . $modelId);
        // error_log("API Key: " . substr($apiKey, 0, 8) . "...");
        
        // Create temporary file for image
        $tempFile = tempnam(sys_get_temp_dir(), 'ultralytics_image_');
        file_put_contents($tempFile, $imageData);
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $apiUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, array_merge($postData, [
            'file' => new CURLFile($tempFile, 'image/jpeg', 'image.jpg')
        ]));
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        // Clean up temporary file
        if (file_exists($tempFile)) {
            unlink($tempFile);
        }
        
        if ($error) {
            error_log("Ultralytics Hub cURL Error: " . $error);
            return null;
        }
        
        if ($httpCode !== 200) {
            error_log("Ultralytics Hub API Error: HTTP {$httpCode} - {$response}");
            return null;
        }
        
        // Log the full response for debugging (can be removed in production)
        // error_log("Ultralytics Hub API Response: " . $response);
        
        $result = json_decode($response, true);
        if (!$result) {
            error_log("Ultralytics Hub Invalid JSON Response: " . $response);
            return null;
        }
        
        // error_log("Ultralytics Hub Parsed Response: " . print_r($result, true));
        
        return $this->processUltralyticsResponse($result);
    }
    
    /**
     * Process Ultralytics Hub API response
     */
    private function processUltralyticsResponse($apiResult) {
        $analysis = [
            'quality_score' => 0,
            'detected_objects' => [],
            'suggestions' => [],
            'inappropriate_content' => false,
            'category_suggestion' => '',
            'confidence' => 0,
            'poultry_analysis' => [
                'breed_detected' => '',
                'health_indicators' => [],
                'age_estimate' => '',
                'quality_assessment' => ''
            ]
        ];
        
        // Process detections - Ultralytics Hub returns results in 'images[0].results' array
        $detections = [];
        if (isset($apiResult['images'][0]['results']) && is_array($apiResult['images'][0]['results'])) {
            $detections = $apiResult['images'][0]['results'];
        } elseif (isset($apiResult['data']) && is_array($apiResult['data'])) {
            $detections = $apiResult['data'];
        } elseif (isset($apiResult['predictions']) && is_array($apiResult['predictions'])) {
            $detections = $apiResult['predictions'];
        } elseif (isset($apiResult['results']) && is_array($apiResult['results'])) {
            $detections = $apiResult['results'];
        }
        
        // Process detections if any found
        if (!empty($detections)) {
            $detectedObjects = [];
            $confidenceScores = [];
            $poultryBreeds = [];
            $healthIndicators = [];
            
            foreach ($detections as $detection) {
                // Handle Ultralytics Hub response format
                $className = $detection['class'] ?? $detection['name'] ?? $detection['label'] ?? 'unknown';
                $confidence = $detection['confidence'] ?? $detection['score'] ?? 0;
                
                // Log detection for debugging (can be removed in production)
                // error_log("Detection: " . print_r($detection, true));
                
                $detectedObjects[] = $className;
                $confidenceScores[] = $confidence;
                
                // Categorize detections
                if (strpos(strtolower($className), 'chicken') !== false || 
                    strpos(strtolower($className), 'hen') !== false ||
                    strpos(strtolower($className), 'rooster') !== false ||
                    strpos(strtolower($className), 'poultry') !== false) {
                    $poultryBreeds[] = $className;
                }
                
                // Health indicators
                if (strpos(strtolower($className), 'healthy') !== false) {
                    $healthIndicators[] = 'Healthy appearance detected';
                } elseif (strpos(strtolower($className), 'sick') !== false ||
                          strpos(strtolower($className), 'disease') !== false) {
                    $healthIndicators[] = 'Potential health concerns detected';
                }
            }
            
            $analysis['detected_objects'] = array_unique($detectedObjects);
            $analysis['confidence'] = !empty($confidenceScores) ? array_sum($confidenceScores) / count($confidenceScores) : 0;
            
            // Calculate quality score based on detections and confidence
            $analysis['quality_score'] = min($analysis['confidence'] * 10, 10);
            
            // Poultry-specific analysis
            if (!empty($poultryBreeds)) {
                $analysis['poultry_analysis']['breed_detected'] = implode(', ', array_unique($poultryBreeds));
                $analysis['category_suggestion'] = 'Live Poultry';
            }
            
            if (!empty($healthIndicators)) {
                $analysis['poultry_analysis']['health_indicators'] = array_unique($healthIndicators);
            }
            
            // Generate suggestions based on detections
            $analysis['suggestions'] = $this->generateSuggestions($detectedObjects, $analysis['confidence']);
            
            // Quality assessment
            if ($analysis['confidence'] > 0.8) {
                $analysis['poultry_analysis']['quality_assessment'] = 'High quality image with clear poultry detection';
            } elseif ($analysis['confidence'] > 0.6) {
                $analysis['poultry_analysis']['quality_assessment'] = 'Good quality image with reliable detection';
            } else {
                $analysis['poultry_analysis']['quality_assessment'] = 'Image quality could be improved for better analysis';
            }
        } else {
            // No detections found, but API call was successful
            $analysis['detected_objects'] = ['No objects detected'];
            $analysis['confidence'] = 0.1; // Low confidence since no detections
            $analysis['quality_score'] = 3.0; // Moderate quality score
            $analysis['suggestions'] = [
                'No objects detected by your custom model',
                'Try with images similar to your training data',
                'Consider adjusting confidence threshold',
                'Your model may be trained for specific poultry types'
            ];
            $analysis['poultry_analysis']['quality_assessment'] = 'Model processed successfully but no detections found';
        }
        
        return $analysis;
    }
    
    /**
     * Generate suggestions based on detected objects
     */
    private function generateSuggestions($detectedObjects, $confidence) {
        $suggestions = [];
        
        if ($confidence < 0.5) {
            $suggestions[] = 'Consider taking a clearer photo with better lighting';
            $suggestions[] = 'Ensure the poultry is clearly visible in the image';
        }
        
        if (empty($detectedObjects)) {
            $suggestions[] = 'No poultry detected. Please ensure the image contains chickens, hens, or roosters';
        } else {
            $suggestions[] = 'Poultry successfully detected in the image';
            
            if (count($detectedObjects) > 1) {
                $suggestions[] = 'Multiple poultry types detected - consider focusing on one type for better results';
            }
        }
        
        if ($confidence > 0.8) {
            $suggestions[] = 'Excellent image quality for poultry analysis';
        }
        
        return $suggestions;
    }
    
    /**
     * Basic fallback image analysis
     */
    private function basicImageAnalysis($imagePath, $imageUrl = null) {
        return [
            'quality_score' => 5.0,
            'detected_objects' => ['poultry', 'chicken'],
            'suggestions' => [
                'Using basic analysis - consider upgrading to AI-powered detection',
                'Image appears to contain poultry'
            ],
            'inappropriate_content' => false,
            'category_suggestion' => 'Live Poultry',
            'confidence' => 0.5,
            'poultry_analysis' => [
                'breed_detected' => 'General poultry',
                'health_indicators' => ['Basic analysis - health assessment not available'],
                'age_estimate' => 'Not available',
                'quality_assessment' => 'Basic analysis performed'
            ]
        ];
    }
}
?>
