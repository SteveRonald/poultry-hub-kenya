<?php
// AI Description Generator Service
// Uses Hugging Face Transformers (free) and fallback templates

class DescriptionGenerator {
    private $config;
    private $cache;
    
    public function __construct() {
        $this->config = require __DIR__ . '/../../config/ai_config.php';
        $this->cache = [];
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
            // Try AI generation first
            if ($this->config['services']['hugging_face']['enabled']) {
                $aiDescription = $this->generateWithAI($productName, $category, $imageAnalysis, $additionalInfo);
                if ($aiDescription) {
                    $description = $aiDescription;
                }
            }
            
            // Fallback to template-based generation
            if (empty($description)) {
                $description = $this->generateWithTemplate($productName, $category, $imageAnalysis, $additionalInfo);
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

