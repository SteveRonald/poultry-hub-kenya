<?php
// AI Description Generator Service
// Uses Hugging Face Transformers (free) and fallback templates

class DescriptionGenerator {
    private $config;
    private $cache;
    private $fingerprintStorePath;
    
    public function __construct() {
        $this->config = require __DIR__ . '/../../config/ai_config.php';
        $this->cache = [];
        // Prepare on-disk store for description fingerprints (simple JSON file)
        $cacheDir = __DIR__ . '/../../cache';
        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0777, true);
        }
        $this->fingerprintStorePath = $cacheDir . '/description_fingerprints.json';
        if (!file_exists($this->fingerprintStorePath)) {
            @file_put_contents($this->fingerprintStorePath, json_encode(['items' => []]));
        }
    }
    
    /**
     * Generate product description based on image analysis and basic info
     */
    public function generateDescription($productName, $category, $imageAnalysis = null, $additionalInfo = []) {
        $cacheKey = md5($productName . $category . serialize($imageAnalysis));
        
        // Check cache first
        if ($this->config['fallback']['cache_results'] && isset($this->cache[$cacheKey])) {
            return $this->cache[$cacheKey];
        }
        
        $description = '';
        
        try {
            // Try OpenAI first
            if ($this->config['services']['openai_vision']['enabled'] && !empty($this->config['services']['openai_vision']['api_key'])) {
                $openaiDescription = $this->generateWithOpenAI($productName, $category, $imageAnalysis, $additionalInfo);
                if ($openaiDescription) {
                    $description = $openaiDescription;
                }
            }
            
            // Try Hugging Face next
            if (empty($description) && $this->config['services']['hugging_face']['enabled']) {
                $aiDescription = $this->generateWithAI($productName, $category, $imageAnalysis, $additionalInfo);
                if ($aiDescription) {
                    $description = $aiDescription;
                }
            }
            
            // Deduplicate: if description is near-duplicate, diversify
            if (!empty($description) && $this->isNearDuplicate($description)) {
                $description = $this->diversifyDescription($description, $productName, $category, $imageAnalysis, $additionalInfo);
            }
            // Persist fingerprint for future checks
            if (!empty($description)) {
                $this->rememberFingerprint($description);
            }

            // Fallback to template-based generation
            if (empty($description)) {
                $description = $this->generateWithTemplate($productName, $category, $imageAnalysis, $additionalInfo);
                // Even for template, apply dedup and remember
                if (!empty($description) && $this->isNearDuplicate($description)) {
                    $description = $this->diversifyDescription($description, $productName, $category, $imageAnalysis, $additionalInfo);
                }
                if (!empty($description)) {
                    $this->rememberFingerprint($description);
                }
            }
            
            // Cache the result
            if ($this->config['fallback']['cache_results']) {
                $this->cache[$cacheKey] = $description;
            }
            
        } catch (Exception $e) {
            error_log("AI Description Generation Error: " . $e->getMessage());
            $description = $this->generateWithTemplate($productName, $category, $imageAnalysis, $additionalInfo);
        }
        
        return $description;
    }
    
    /**
     * Generate description using OpenAI
     */
    private function generateWithOpenAI($productName, $category, $imageAnalysis, $additionalInfo) {
        $apiKey = $this->config['services']['openai_vision']['api_key'] ?? '';
        if (empty($apiKey)) {
            return null;
        }
        
        $context = $this->buildContext($productName, $category, $imageAnalysis, $additionalInfo);
        
        $prompt = "Generate a professional product description for a poultry marketplace. " .
                  "Product: $productName. Category: $category. Context: $context " .
                  "Make it informative, appealing, and suitable for farmers and customers. " .
                  "Include key features, benefits, and usage information. Keep it under 200 words and professional.";
        
        $data = [
            "model" => "gpt-4o-mini",
            "messages" => [
                [
                    "role" => "user",
                    "content" => [
                        [
                            "type" => "text",
                            "text" => $prompt
                        ]
                    ]
                ]
            ],
            "max_tokens" => 300,
            "temperature" => 0.7
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://api.openai.com/v1/chat/completions");
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        
        // Quick retry on 429 (rate limited)
        if ($httpCode === 429) {
            usleep(200000); // 200ms
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, "https://api.openai.com/v1/chat/completions");
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey
            ]);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
        }
        
        if ($httpCode !== 200 || !$response) {
            return null;
        }
        
        $result = json_decode($response, true);
        $content = $result['choices'][0]['message']['content'] ?? '';
        if (empty($content)) {
            return null;
        }
        
        $description = trim($content);
        return $description;
    }
    
    /**
     * Generate description using Hugging Face API
     */
    private function generateWithAI($productName, $category, $imageAnalysis, $additionalInfo) {
        // Prepare context for AI
        $context = $this->buildContext($productName, $category, $imageAnalysis, $additionalInfo);
        
        // Use Hugging Face Inference API (free tier)
        $model = $this->config['services']['hugging_face']['models']['description_generation'];
        $url = "https://api-inference.huggingface.co/models/$model";
        
        $prompt = "Generate a professional product description for a poultry marketplace. ";
        $prompt .= "Product: $productName. Category: $category. ";
        $prompt .= "Context: $context. ";
        $prompt .= "Make it informative, appealing, and suitable for farmers and customers. ";
        $prompt .= "Include key features, benefits, and usage information. ";
        $prompt .= "Keep it under 200 words and professional.";
        
        $data = [
            'inputs' => $prompt,
            'parameters' => [
                'max_length' => 200,
                'temperature' => 0.7,
                'do_sample' => true
            ]
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
            error_log("Hugging Face API Error: HTTP $httpCode - $response");
            return null;
        }
        
        $result = json_decode($response, true);
        if (!$result || !isset($result[0]['generated_text'])) {
            return null;
        }
        
        $generatedText = $result[0]['generated_text'];
        
        // Clean up the generated text
        $description = $this->cleanGeneratedText($generatedText, $prompt);
        
        return $description;
    }
    
    /**
     * Generate description using templates
     */
    private function generateWithTemplate($productName, $category, $imageAnalysis, $additionalInfo) {
        $templates = $this->getTemplates();
        $template = $templates[$category] ?? $templates['default'];
        
        // Extract information from image analysis
        $detectedObjects = $imageAnalysis['detected_objects'] ?? [];
        $qualityScore = $imageAnalysis['quality_score'] ?? 5;
        
        // Build description using template
        $description = $template;
        
        // Replace placeholders
        $replacements = [
            '{product_name}' => $productName,
            '{category}' => $category,
            '{quality_indicator}' => $this->getQualityIndicator($qualityScore),
            '{detected_features}' => $this->formatDetectedFeatures($detectedObjects),
            '{additional_info}' => $this->formatAdditionalInfo($additionalInfo)
        ];
        
        foreach ($replacements as $placeholder => $value) {
            $description = str_replace($placeholder, $value, $description);
        }
        
        return $description;
    }
    
    /**
     * Build context for AI generation
     */
    private function buildContext($productName, $category, $imageAnalysis, $additionalInfo) {
        $context = "Category: $category. ";
        
        if ($imageAnalysis && !empty($imageAnalysis['detected_objects'])) {
            $context .= "Detected objects: " . implode(', ', $imageAnalysis['detected_objects']) . ". ";
        }
        
        if (!empty($additionalInfo)) {
            $context .= "Additional info: " . implode(', ', $additionalInfo) . ". ";
        }
        
        return $context;
    }
    
    /**
     * Clean generated text
     */
    private function cleanGeneratedText($generatedText, $prompt) {
        // Remove the prompt from the beginning
        $description = str_replace($prompt, '', $generatedText);
        $description = trim($description);
        
        // Remove any incomplete sentences at the end
        $sentences = explode('.', $description);
        if (count($sentences) > 1) {
            $lastSentence = trim(end($sentences));
            if (strlen($lastSentence) < 10) {
                array_pop($sentences);
                $description = implode('.', $sentences) . '.';
            }
        }
        
        // Ensure proper capitalization
        $description = ucfirst(trim($description));
        
        return $description;
    }
    
    /**
     * Get description templates
     */
    private function getTemplates() {
        return [
            'Live Poultry' => "{product_name} - Premium quality {category} raised on our family farm. {quality_indicator} These birds are {detected_features} and perfect for {additional_info}. Raised with natural feed and proper care. Available for immediate delivery. Contact us for more details.",
            
            'Eggs' => "{product_name} - Fresh, high-quality {category} from our healthy hens. {quality_indicator} {detected_features} These eggs are {additional_info} and perfect for home consumption or commercial use. Collected daily and stored properly. Order now for the freshest eggs available.",
            
            'Feed & Nutrition' => "{product_name} - Premium {category} for optimal poultry health and growth. {quality_indicator} {detected_features} This feed is {additional_info} and provides essential nutrients for your birds. Suitable for all poultry types. Available in various sizes.",
            
            'Equipment' => "{product_name} - High-quality {category} for your poultry farming needs. {quality_indicator} {detected_features} This equipment is {additional_info} and designed for durability and efficiency. Perfect for both small and large-scale operations.",
            
            'default' => "{product_name} - Quality {category} for your poultry needs. {quality_indicator} {detected_features} This product is {additional_info} and suitable for various poultry farming applications. Contact us for more information and pricing."
        ];
    }

    /**
     * Simple normalization and fingerprinting helpers
     */
    private function normalizeText($text) {
        $text = strtolower($text);
        // Remove punctuation and collapse whitespace
        $text = preg_replace('/[^a-z0-9\s]/', ' ', $text);
        $text = preg_replace('/\s+/', ' ', trim($text));
        return $text;
    }
    
    private function fingerprint($text) {
        return sha1($this->normalizeText($text));
    }
    
    private function loadFingerprintStore() {
        $raw = @file_get_contents($this->fingerprintStorePath);
        if (!$raw) return ['items' => []];
        $data = json_decode($raw, true);
        if (!is_array($data) || !isset($data['items']) || !is_array($data['items'])) {
            return ['items' => []];
        }
        return $data;
    }
    
    private function saveFingerprintStore($store) {
        // Limit to last 200 entries
        if (isset($store['items']) && count($store['items']) > 200) {
            $store['items'] = array_slice($store['items'], -200);
        }
        @file_put_contents($this->fingerprintStorePath, json_encode($store));
    }
    
    private function isNearDuplicate($text) {
        $store = $this->loadFingerprintStore();
        $fp = $this->fingerprint($text);
        foreach ($store['items'] as $item) {
            // Exact fingerprint match
            if (!empty($item['fp']) && $item['fp'] === $fp) {
                return true;
            }
            // Similarity check using similar_text percentage on normalized strings
            if (!empty($item['sample'])) {
                $a = $this->normalizeText($text);
                $b = $this->normalizeText($item['sample']);
                $percent = 0.0;
                similar_text($a, $b, $percent);
                if ($percent >= 90.0) {
                    return true;
                }
            }
        }
        return false;
    }
    
    private function rememberFingerprint($text) {
        $store = $this->loadFingerprintStore();
        $store['items'][] = [
            'fp' => $this->fingerprint($text),
            'sample' => mb_substr($text, 0, 500),
            'ts' => time()
        ];
        $this->saveFingerprintStore($store);
    }
    
    private function diversifyDescription($text, $productName, $category, $imageAnalysis, $additionalInfo) {
        // Add specific attributes to differentiate similar descriptions
        $traits = [];
        if (!empty($additionalInfo)) {
            $traits = array_slice($additionalInfo, 0, 3);
        }
        if (empty($traits) && !empty($imageAnalysis['detected_objects'])) {
            $traits = array_slice($imageAnalysis['detected_objects'], 0, 3);
        }
        $traitsLine = !empty($traits) ? (' Key specifics: ' . implode(', ', $traits) . '.') : '';
        // Ensure product/category mention for uniqueness
        $suffix = " This description is tailored for $productName in the $category category." . $traitsLine;
        $augmented = rtrim($text);
        if (substr($augmented, -1) !== '.') {
            $augmented .= '.';
        }
        $augmented .= $suffix;
        return $augmented;
    }
    
    /**
     * Get quality indicator text
     */
    private function getQualityIndicator($qualityScore) {
        if ($qualityScore >= 8) {
            return "Excellent quality with high standards.";
        } elseif ($qualityScore >= 6) {
            return "Good quality and well-maintained.";
        } elseif ($qualityScore >= 4) {
            return "Standard quality for everyday use.";
        } else {
            return "Basic quality at affordable prices.";
        }
    }
    
    /**
     * Format detected features
     */
    private function formatDetectedFeatures($detectedObjects) {
        if (empty($detectedObjects)) {
            return "carefully selected";
        }
        
        $poultryTerms = ['chicken', 'poultry', 'bird', 'hen', 'rooster', 'chick'];
        $eggTerms = ['egg', 'eggs'];
        $feedTerms = ['feed', 'food', 'grain'];
        
        $features = [];
        foreach ($detectedObjects as $object) {
            if (array_intersect(explode(' ', $object), $poultryTerms)) {
                $features[] = "healthy and active";
            } elseif (array_intersect(explode(' ', $object), $eggTerms)) {
                $features[] = "fresh and clean";
            } elseif (array_intersect(explode(' ', $object), $feedTerms)) {
                $features[] = "nutritious and balanced";
            }
        }
        
        return !empty($features) ? implode(', ', array_unique($features)) : "carefully selected";
    }
    
    /**
     * Format additional information
     */
    private function formatAdditionalInfo($additionalInfo) {
        if (empty($additionalInfo)) {
            return "various farming needs";
        }
        
        return implode(', ', $additionalInfo);
    }
    
    /**
     * Suggest product name improvements
     */
    public function suggestProductName($currentName, $category, $imageAnalysis = null) {
        $suggestions = [];
        
        // Basic name validation
        if (strlen($currentName) < 3) {
            $suggestions[] = "Product name is too short. Consider adding more descriptive words.";
        }
        
        if (strlen($currentName) > 50) {
            $suggestions[] = "Product name is quite long. Consider shortening for better readability.";
        }
        
        // Category-specific suggestions
        $categoryKeywords = [
            'Live Poultry' => ['chicken', 'broiler', 'layer', 'hen', 'rooster', 'chick'],
            'Eggs' => ['egg', 'fresh', 'organic', 'free-range'],
            'Feed & Nutrition' => ['feed', 'nutrition', 'poultry', 'chicken'],
            'Equipment' => ['equipment', 'tool', 'device', 'system']
        ];
        
        $keywords = $categoryKeywords[$category] ?? [];
        $nameLower = strtolower($currentName);
        
        $hasCategoryKeyword = false;
        foreach ($keywords as $keyword) {
            if (strpos($nameLower, $keyword) !== false) {
                $hasCategoryKeyword = true;
                break;
            }
        }
        
        if (!$hasCategoryKeyword && !empty($keywords)) {
            $suggestions[] = "Consider including category-specific keywords like: " . implode(', ', array_slice($keywords, 0, 3));
        }
        
        // Image-based suggestions
        if ($imageAnalysis && !empty($imageAnalysis['detected_objects'])) {
            $detectedObjects = $imageAnalysis['detected_objects'];
            $relevantObjects = array_intersect($detectedObjects, $keywords);
            
            if (!empty($relevantObjects)) {
                $suggestions[] = "Great! Your image shows " . implode(', ', $relevantObjects) . " which matches your product.";
            }
        }
        
        return $suggestions;
    }
}
?>

