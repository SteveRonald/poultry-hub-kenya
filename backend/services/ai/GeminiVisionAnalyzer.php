<?php
// Google Gemini Vision API Integration for Poultry Detection and Image Analysis
require_once __DIR__ . '/../../config/ai_config.php';

class GeminiVisionAnalyzer {
    private $config;
    private $apiKey;
    
    public function __construct() {
        $this->config = require __DIR__ . '/../../config/ai_config.php';
        $this->apiKey = $this->config['services']['gemini']['api_key'] ?? '';
    }
    
    /**
     * Analyze image using Gemini Vision API
     * Returns analysis with poultry-marketplace relevance verification
     */
    public function analyzeImage($imagePath, $imageUrl = null) {
        if (empty($this->apiKey)) {
            return $this->getErrorResponse('Image verification service configuration is incomplete.');
        }
        
        try {
            // Validate image file exists
            if (!$imageUrl && !file_exists($imagePath)) {
                return $this->getErrorResponse('Image file not found: ' . $imagePath);
            }
            
            // Convert local file to base64 if needed
            if (!$imageUrl && file_exists($imagePath)) {
                $imageData = file_get_contents($imagePath);
                if ($imageData === false || empty($imageData)) {
                    return $this->getErrorResponse('Failed to read image file or file is empty.');
                }
                
                // Detect MIME type
                $mimeType = $this->detectImageMimeType($imagePath);
                if (!$mimeType) {
                    return $this->getErrorResponse('Unable to detect image type. Supported formats: JPEG, PNG, GIF, WebP');
                }
                
                // Check file size (Gemini has a limit of ~20MB)
                $fileSize = strlen($imageData);
                $maxSize = 20 * 1024 * 1024; // 20MB
                if ($fileSize > $maxSize) {
                    return $this->getErrorResponse('Image file is too large. Maximum size is 20MB. Current size: ' . round($fileSize / 1024 / 1024, 2) . 'MB');
                }
                
                $base64Image = base64_encode($imageData);
                $result = $this->analyzeWithGemini($base64Image, $mimeType, true);
            } elseif ($imageUrl) {
                // Gemini can handle URLs directly, but we'll convert to base64 for consistency
                $result = $this->analyzeWithGemini($imageUrl, 'image/jpeg', false);
            } else {
                return $this->getErrorResponse('Image file not found or invalid image URL.');
            }
            
            // Check if API call returned a result
            if ($result === null) {
                return $this->getErrorResponse('Image verification service returned no response. Please try again.');
            }
            
            // Check if result contains an error
            if (is_array($result) && isset($result['error'])) {
                $errorMsg = $result['error'];
                $errorType = $result['error_type'] ?? 'unknown';
                
                // Provide helpful messages for common error types
                if ($errorType === 'quota_exceeded' || strpos($errorMsg, 'quota') !== false || strpos($errorMsg, '429') !== false) {
                    $helpfulMsg = "Image verification limit reached. Please try again later.";
                    return $this->getErrorResponse($helpfulMsg);
                }
                
                return $this->getErrorResponse("Image verification service error: {$errorMsg}");
            }
            
            // Process the result
            if (is_array($result) && !isset($result['error'])) {
                return $this->processGeminiResult($result, $imagePath);
            }
            
            // If result is not an array, it's an error
            return $this->getErrorResponse('Invalid response from image verification service. Please try again.');
            
        } catch (Exception $e) {
            error_log("Gemini Vision API Error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return $this->getErrorResponse('Failed to analyze image: ' . $e->getMessage());
        }
    }
    
    /**
     * Detect image MIME type from file
     */
    private function detectImageMimeType($imagePath) {
        // Try using finfo first (most reliable)
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_file($finfo, $imagePath);
            
            // Validate it's an image type
            $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (in_array($mimeType, $allowedTypes)) {
                return $mimeType;
            }
        }
        
        // Fallback to file extension
        $extension = strtolower(pathinfo($imagePath, PATHINFO_EXTENSION));
        $mimeMap = [
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp'
        ];
        
        return $mimeMap[$extension] ?? null;
    }
    
    /**
     * Analyze with Gemini Vision API
     */
    private function analyzeWithGemini($imageSource, $mimeType = 'image/jpeg', $isBase64 = true) {
        $model = $this->config['services']['gemini']['vision_model'] ?? 'gemini-2.5-flash';
        $temperature = $this->config['services']['gemini']['vision_temperature'] ?? 0.1;
        $apiKey = $this->apiKey;
        
        // Gemini API endpoint
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
        
        // Prompt tuned for poultry marketplace relevance and manual review workflow
        $prompt = "You are an expert poultry marketplace image analyzer. Analyze this image and determine whether it is relevant to poultry farming or the poultry supply chain.

RELEVANCE RULES:
- Clearly relevant content includes: chickens, hens, roosters, chicks, ducks, geese, turkeys, eggs, poultry feed, grain, seed, corn, wheat, poultry meat, cages, coops, nests, feeders, waterers, incubators, hatchery equipment, brooders, drinkers, farm tools, poultry medicine, disinfectants, protective gear, gumboots, work boots, gloves, overalls, cleaning tools, storage tools, and other items reasonably used in poultry farming.
- Borderline but potentially relevant content should still be treated as poultry-related if it can reasonably be used in poultry farming, even if poultry animals are not visible.
- Non-relevant content includes: fashion items with no farming use, electronics unrelated to farming, furniture, unrelated household goods, beauty items, phones, TVs, handbags, toys, and clearly unrelated products.

ANALYSIS REQUIREMENTS:
1. Decide whether the item is poultry-related or plausibly used in poultry farming
2. Identify all detected objects
3. Assess image quality (1-10 scale)
4. Suggest appropriate category
5. Provide confidence score (0.0-1.0)
6. Provide a relevance_status of clear_match, borderline_match, or out_of_scope
7. Generate a brief image description for use in product descriptions

Respond with a JSON object in this EXACT format:
{
  \"is_poultry_related\": true/false,
  \"relevance_status\": \"clear_match\" OR \"borderline_match\" OR \"out_of_scope\",
  \"detected_objects\": [\"list\", \"of\", \"detected\", \"objects\"],
  \"category\": \"Live Poultry\" OR \"Eggs\" OR \"Feed & Nutrition\" OR \"Poultry Meat\" OR \"Equipment\" OR \"Other\",
  \"database_category\": \"chickens\" OR \"eggs\" OR \"feed\" OR \"equipment\" OR \"medicine\" OR \"chicks\" OR \"other\",
  \"confidence\": 0.0-1.0,
  \"quality_score\": 1-10,
  \"image_description\": \"Brief description of what's in the image (1-2 sentences)\",
  \"suggestions\": [\"suggestion1\", \"suggestion2\"],
  \"rejection_reason\": \"Only include if is_poultry_related is false - explain why\"
}

Note: The database_category field should match one of these exact values: chickens, eggs, feed, equipment, medicine, chicks, or other.

CRITICAL:
- If the item is clearly relevant to poultry farming, set is_poultry_related to true and relevance_status to clear_match.
- If the item might reasonably be used in poultry farming but you are not fully certain, set is_poultry_related to true and relevance_status to borderline_match.
- Only set is_poultry_related to false when the item is clearly out of scope for poultry farming.";
        
        // Build the request payload
        $parts = [];
        
        // Add image part
        if ($isBase64) {
            $parts[] = [
                "inline_data" => [
                    "mime_type" => $mimeType,
                    "data" => $imageSource
                ]
            ];
        } else {
            // For URLs, Gemini can handle them, but we'll need to fetch and convert
            // For now, we'll assume base64 is provided
            $parts[] = [
                "inline_data" => [
                    "mime_type" => $mimeType,
                    "data" => $imageSource
                ]
            ];
        }
        
        // Add text part
        $parts[] = [
            "text" => $prompt
        ];
        
        $data = [
            "contents" => [
                [
                    "parts" => $parts
                ]
            ],
            "generationConfig" => [
                "temperature" => $temperature,
                "maxOutputTokens" => 1000,
                "responseMimeType" => "application/json" // Request JSON response
            ]
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60); // Increased timeout for image analysis
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10); // Connection timeout
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        $curlInfo = curl_getinfo($ch);
        
        if ($curlError) {
            error_log("Gemini Vision API cURL Error: " . $curlError);
            error_log("cURL Info: " . json_encode([
                'url' => $curlInfo['url'] ?? 'unknown',
                'total_time' => $curlInfo['total_time'] ?? 0,
                'connect_time' => $curlInfo['connect_time'] ?? 0
            ]));
            return null;
        }
        
        // Log request details for debugging
        if ($httpCode !== 200) {
            error_log("Gemini Vision API Request failed - HTTP $httpCode");
            error_log("Model: $model");
            error_log("MIME Type: " . ($mimeType ?? 'unknown'));
            error_log("Response (first 500 chars): " . substr($response, 0, 500));
        }
        
        if ($httpCode === 200) {
            $responseData = json_decode($response, true);
            if (!$responseData) {
                error_log("Gemini Vision API Error: Invalid JSON response");
                error_log("Response (first 500 chars): " . substr($response, 0, 500));
                return null;
            }
            
            // Check for errors in response
            if (isset($responseData['error'])) {
                $errorMessage = $responseData['error']['message'] ?? 'Unknown error';
                $errorCode = $responseData['error']['code'] ?? 'unknown';
                error_log("Gemini API Error Code: $errorCode");
                error_log("Gemini API Error Message: $errorMessage");
                
                return [
                    'error' => $errorMessage,
                    'error_type' => $errorCode,
                    'http_code' => $httpCode
                ];
            }
            
            // Extract content from response
            if (isset($responseData['candidates'][0]['content']['parts'][0]['text'])) {
                $content = $responseData['candidates'][0]['content']['parts'][0]['text'];
                
                // Parse JSON response
                $jsonResult = json_decode($content, true);
                if ($jsonResult && is_array($jsonResult)) {
                    return $jsonResult;
                }
                
                // Fallback: Try to extract JSON if wrapped in markdown
                if (preg_match('/```json\s*(\{.*?\})\s*```/s', $content, $matches)) {
                    $jsonResult = json_decode($matches[1], true);
                    if ($jsonResult && is_array($jsonResult)) {
                        return $jsonResult;
                    }
                }
                
                // Fallback: Try to extract any JSON object
                if (preg_match('/\{.*\}/s', $content, $matches)) {
                    $jsonResult = json_decode($matches[0], true);
                    if ($jsonResult && is_array($jsonResult)) {
                        return $jsonResult;
                    }
                }
                
                error_log("Gemini Vision API Error: Could not parse JSON from response");
                error_log("Content (first 500 chars): " . substr($content, 0, 500));
            } else {
                error_log("Gemini Vision API Error: No content in response");
                error_log("Response data: " . json_encode($responseData));
            }
        } else {
            error_log("Gemini Vision API Error: HTTP $httpCode");
            $errorData = json_decode($response, true);
            if ($errorData && isset($errorData['error'])) {
                $errorMessage = $errorData['error']['message'] ?? 'Unknown error';
                $errorCode = $errorData['error']['code'] ?? 'unknown';
                error_log("Gemini API Error Code: $errorCode");
                error_log("Gemini API Error Message: $errorMessage");
                
                return [
                    'error' => $errorMessage,
                    'error_type' => $errorCode,
                    'http_code' => $httpCode
                ];
            } else {
                error_log("Gemini Vision API Error: Unexpected response format");
                error_log("Response (first 500 chars): " . substr($response, 0, 500));
            }
            return null;
        }
        
        return null;
    }
    
    /**
     * Process Gemini result into standardized format
     */
    private function processGeminiResult($result, $imagePath) {
        // Map AI category to database category
        require_once __DIR__ . '/../../utils/category_mapper.php';
        $aiCategory = $result['category'] ?? 'Other';
        $databaseCategory = isset($result['database_category']) && isValidDatabaseCategory($result['database_category'])
            ? $result['database_category']
            : mapAICategoryToDatabase($aiCategory);
        
        // Ensure all required fields are present
        $analysis = [
            'quality_score' => isset($result['quality_score']) ? (int)$result['quality_score'] : 5,
            'detected_objects' => isset($result['detected_objects']) && is_array($result['detected_objects']) 
                ? $result['detected_objects'] 
                : [],
            'suggestions' => [],
            'inappropriate_content' => false,
            'category_suggestion' => $aiCategory,
            'database_category' => $databaseCategory,
            'confidence' => isset($result['confidence']) ? (float)$result['confidence'] : 0.5,
            'is_poultry_related' => isset($result['is_poultry_related']) ? (bool)$result['is_poultry_related'] : false,
            'relevance_status' => $result['relevance_status'] ?? 'out_of_scope',
            'analysis_method' => 'gemini_vision',
            'image_description' => $result['image_description'] ?? '',
            'rejection_reason' => $result['rejection_reason'] ?? null
        ];
        
        // Add professional messages based on poultry relation
        if (!$analysis['is_poultry_related']) {
            $analysis['suggestions'] = ['Not poultry related. Please upload poultry-related images only.'];
            $analysis['rejection_reason'] = 'Not poultry related. Please upload poultry-related images only.';
        } elseif (($analysis['relevance_status'] ?? '') === 'borderline_match') {
            $analysis['suggestions'] = ['This image may be poultry-related, but AI is not fully certain. It can proceed for manual review.'];
        } else {
            $analysis['suggestions'] = ['Image verified successfully.'];
        }
        
        return $analysis;
    }
    
    /**
     * Get error response when API is unavailable or has issues
     */
    private function getErrorResponse($message) {
        // Log the detailed error for debugging but don't show internal details to vendor
        error_log("AI verification internal error: " . $message);
        
        // Check for specific error types to give better feedback without leaking internals
        $userFriendlyMessage = 'Image verification service is temporarily unavailable. Please try again later.';
        
        if (strpos($message, 'not configured') !== false || strpos($message, 'API key') !== false || strpos($message, 'configuration') !== false) {
            $userFriendlyMessage = 'AI verification is currently being set up. Please try again later.';
        } elseif (strpos($message, 'quota') !== false || strpos($message, '429') !== false) {
            $userFriendlyMessage = 'Verification limit reached. Please try again in a moment.';
        }
        
        return [
            'quality_score' => 0,
            'detected_objects' => [],
            'suggestions' => [$userFriendlyMessage],
            'inappropriate_content' => false,
            'category_suggestion' => 'Pending Verification',
            'confidence' => 0.0,
            'is_poultry_related' => false,
            'analysis_method' => 'error',
            'image_description' => '',
            'rejection_reason' => $userFriendlyMessage,
            'error' => $userFriendlyMessage // User-friendly error for the UI
        ];
    }
}
?>
