<?php
// OpenAI Vision API Integration for Poultry Detection
require_once __DIR__ . '/../../config/ai_config.php';

class OpenAIVisionAnalyzer {
    private $config;
    private $apiKey;
    
    public function __construct() {
        $this->config = require __DIR__ . '/../../config/ai_config.php';
        $this->apiKey = $this->config['services']['openai_vision']['api_key'] ?? '';
    }
    
    /**
     * Analyze image using OpenAI Vision API
     */
    public function analyzeImage($imagePath, $imageUrl = null) {
        if (empty($this->apiKey)) {
            return $this->fallbackAnalysis($imagePath);
        }
        
        try {
            $imageSource = $imageUrl ?: $imagePath;
            
            if ($imageUrl) {
                $result = $this->analyzeWithOpenAI($imageUrl);
            } else {
                // Convert local file to base64
                if (!file_exists($imagePath)) {
                    return $this->fallbackAnalysis($imagePath);
                }
                
                $imageData = file_get_contents($imagePath);
                $base64Image = base64_encode($imageData);
                $result = $this->analyzeWithOpenAI($base64Image, true);
            }
            
            if ($result) {
                return $this->processOpenAIResult($result, $imagePath);
            }
            
        } catch (Exception $e) {
            error_log("OpenAI Vision API Error: " . $e->getMessage());
        }
        
        return $this->fallbackAnalysis($imagePath);
    }
    
    /**
     * Analyze with OpenAI Vision API
     */
    private function analyzeWithOpenAI($imageSource, $isBase64 = false) {
        $url = "https://api.openai.com/v1/chat/completions";
        
        // Prepare the image
        if ($isBase64) {
            $imageContent = [
                "type" => "image_url",
                "image_url" => [
                    "url" => "data:image/jpeg;base64," . $imageSource
                ]
            ];
        } else {
            $imageContent = [
                "type" => "image_url",
                "image_url" => [
                    "url" => $imageSource
                ]
            ];
        }
        
        $data = [
            "model" => "gpt-4o",
            "messages" => [
                [
                    "role" => "user",
                    "content" => [
                        [
                            "type" => "text",
                            "text" => "Analyze this image for poultry-related content. Look for chickens, hens, roosters, chicks, ducks, geese, turkeys, eggs, poultry feed, grain, seed, corn, wheat, poultry meat, chicken meat, cages, coops, nests, feeders, waterers, or any poultry equipment. 

Respond with a JSON object containing:
{
  \"is_poultry_related\": true/false,
  \"detected_objects\": [\"list\", \"of\", \"objects\"],
  \"category\": \"Live Poultry/Eggs/Feed & Nutrition/Poultry Meat/Equipment/Other\",
  \"confidence\": 0.0-1.0,
  \"quality_score\": 1-10,
  \"suggestions\": [\"list\", \"of\", \"suggestions\"]
}

Be strict - only return true for is_poultry_related if you can clearly see poultry-related content. If you see cars, houses, people, or other non-poultry content, return false."
                        ],
                        $imageContent
                    ]
                ]
            ],
            "max_tokens" => 500,
            "temperature" => 0.1
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $this->apiKey
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode === 200) {
            $data = json_decode($response, true);
            if (isset($data['choices'][0]['message']['content'])) {
                $content = $data['choices'][0]['message']['content'];
                
                // Try to extract JSON from the response
                if (preg_match('/\{.*\}/s', $content, $matches)) {
                    $jsonResult = json_decode($matches[0], true);
                    if ($jsonResult) {
                        return $jsonResult;
                    }
                }
            }
        }
        
        return null;
    }
    
    /**
     * Process OpenAI result
     */
    private function processOpenAIResult($result, $imagePath) {
        return [
            'quality_score' => $result['quality_score'] ?? 5,
            'detected_objects' => $result['detected_objects'] ?? [],
            'suggestions' => $result['suggestions'] ?? ['Image analyzed successfully'],
            'inappropriate_content' => false,
            'category_suggestion' => $result['category'] ?? 'Other',
            'confidence' => $result['confidence'] ?? 0.5,
            'is_poultry_related' => $result['is_poultry_related'] ?? false,
            'analysis_method' => 'openai_vision',
            'raw_response' => $result
        ];
    }
    
    /**
     * Fallback analysis when OpenAI is not available
     */
    private function fallbackAnalysis($imagePath) {
        $filename = basename($imagePath);
        
        return [
            'quality_score' => 3,
            'detected_objects' => [],
            'suggestions' => [
                '⚠️ OpenAI Vision not available - using basic analysis',
                '❌ Cannot verify if image contains poultry products',
                'Please set up OpenAI Vision API for accurate detection',
                'Upload only poultry-related images (chickens, eggs, feed, equipment)'
            ],
            'inappropriate_content' => false,
            'category_suggestion' => 'Unknown - Requires AI Verification',
            'confidence' => 0.3,
            'is_poultry_related' => false,
            'analysis_method' => 'fallback_strict'
        ];
    }
}
?>
