<?php
// AI Description Generator Service
// Uses Google Gemini API for product description generation

class DescriptionGenerator {
    private $config;
    private $cache;
    private $apiKey;
    
    public function __construct() {
        $this->config = require __DIR__ . '/../../config/ai_config.php';
        $this->cache = [];
        $this->apiKey = $this->config['services']['gemini']['api_key'] ?? '';
    }
    
    /**
     * Generate product description using Gemini
     * Based on product name, category, image analysis, and additional info
     */
    public function generateDescription($productName, $category, $imageAnalysis = null, $additionalInfo = []) {
        if (empty($this->apiKey)) {
            return $this->getErrorResponse('Gemini API key is not configured. Please set GEMINI_API_KEY or GOOGLE_API_KEY in your environment variables.');
        }
        
        // Check cache
        $cacheKey = md5($productName . $category . serialize($imageAnalysis) . serialize($additionalInfo));
        if (isset($this->cache[$cacheKey])) {
            return $this->cache[$cacheKey];
        }
        
        try {
            $description = $this->generateWithGemini($productName, $category, $imageAnalysis, $additionalInfo);
            
            if ($description && !isset($description['error'])) {
                // Cache the result
                $this->cache[$cacheKey] = $description;
                return $description;
            }
            
            return $description;
            
        } catch (Exception $e) {
            error_log("Gemini Description Generation Error: " . $e->getMessage());
            return $this->getErrorResponse('Failed to generate description: ' . $e->getMessage());
        }
    }
    
    /**
     * Generate description using Gemini API
     */
    private function generateWithGemini($productName, $category, $imageAnalysis, $additionalInfo) {
        $model = $this->config['services']['gemini']['text_model'] ?? 'gemini-2.5-flash';
        $temperature = $this->config['services']['gemini']['temperature'] ?? 0.7;
        $maxTokens = $this->config['services']['gemini']['max_tokens'] ?? 1000;
        $apiKey = $this->apiKey;
        
        // Gemini API endpoint
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
        
        // Build comprehensive context from image analysis
        $imageContext = '';
        if ($imageAnalysis && !isset($imageAnalysis['error']) && $imageAnalysis['analysis_method'] !== 'error') {
            // Use image description as primary context
            if (!empty($imageAnalysis['image_description'])) {
                $imageContext .= "IMAGE ANALYSIS - What the image shows: " . $imageAnalysis['image_description'] . ". ";
            }
            
            // Include detected objects for accuracy
            if (!empty($imageAnalysis['detected_objects']) && is_array($imageAnalysis['detected_objects'])) {
                $detectedItems = implode(', ', $imageAnalysis['detected_objects']);
                $imageContext .= "Detected objects in the image: " . $detectedItems . ". ";
            }
            
            // Include category suggestion if available
            if (!empty($imageAnalysis['category_suggestion'])) {
                $imageContext .= "Category suggested by image analysis: " . $imageAnalysis['category_suggestion'] . ". ";
            }
            
            // Include quality score if available
            if (isset($imageAnalysis['quality_score'])) {
                $imageContext .= "Image quality score: " . $imageAnalysis['quality_score'] . "/10. ";
            }
            
            // Important instruction to use image data
            $imageContext .= "CRITICAL: The product description MUST accurately reflect what is shown in the image. Use the image analysis data to create an accurate, detailed description that matches the actual product in the image.";
        }
        
        // Build additional info context
        $additionalContext = '';
        if (!empty($additionalInfo)) {
            if (is_array($additionalInfo)) {
                $additionalContext = "Additional details: " . implode(', ', $additionalInfo) . ". ";
            } else {
                $additionalContext = "Additional details: " . $additionalInfo . ". ";
            }
        }
        
        // Get description length limits from config
        $minWords = $this->config['limits']['description_length']['optimal_min'] ?? 150;
        $maxWords = $this->config['limits']['description_length']['optimal_max'] ?? 300;
        $maxChars = $this->config['limits']['description_length']['max_characters'] ?? 2500;
        
        // Create comprehensive SEO-optimized prompt
        $prompt = "You are an expert e-commerce copywriter specializing in poultry products for the Kenyan market. Generate a professional, SEO-optimized product description that converts visitors into buyers.

PRODUCT INFORMATION:
- Product Name: {$productName}
- Category: {$category}
{$imageContext}{$additionalContext}

E-COMMERCE & SEO REQUIREMENTS:
1. Write a compelling product description ({$minWords}-{$maxWords} words, maximum {$maxChars} characters)
2. Include primary SEO keywords naturally: poultry, chicken, farm, Kenya, quality, healthy, fresh
3. Structure for e-commerce: Start with a hook, highlight key benefits, include specific details, end with value proposition
4. Use farmer-friendly language that appeals to both small-scale and commercial farmers
5. Include practical benefits: health benefits, growth potential, productivity, profitability
6. Mention quality indicators: well-maintained, vaccinated, fresh, certified, quality-assured
7. Include relevant details: age, breed, size, condition, origin (if known from image/name)
8. Use natural, conversational tone - avoid robotic or overly formal language
9. Write in plain text format - NO markdown, NO asterisks, NO special formatting characters
10. Use clear paragraphs and natural breaks for readability

CONTENT STRUCTURE:
- Opening: Compelling hook that highlights the main benefit or unique selling point
- Body: Detailed description of features, benefits, and quality indicators
- Closing: Call to action or value proposition that encourages purchase

STYLE GUIDELINES:
- Write in plain, natural English - no markdown formatting
- Use active voice and present tense
- Focus on benefits that matter to farmers (health, growth, productivity, profitability)
- Include specific details when available (detected from image or provided)
- Make it scannable with clear paragraphs
- Sound authentic and trustworthy, not AI-generated

CRITICAL: 
- The description MUST be between {$minWords} and {$maxWords} words (maximum {$maxChars} characters)
- Write in PLAIN TEXT only - NO markdown, NO asterisks (*), NO bold markers (**), NO formatting
- Generate ONLY the product description text, without any labels, headers, or introductory text
- Ensure the description accurately reflects what is shown in the image (if image analysis is provided)";

        // Build Gemini API request
        $data = [
            "contents" => [
                [
                    "parts" => [
                        [
                            "text" => $prompt
                        ]
                    ]
                ]
            ],
            "generationConfig" => [
                "temperature" => $temperature,
                "maxOutputTokens" => $maxTokens
            ]
        ];
        
        // Adjust maxOutputTokens based on character limit (approximately 4 characters per token)
        $maxChars = $this->config['limits']['description_length']['max_characters'] ?? 2500;
        $estimatedMaxTokens = (int)($maxChars / 4) + 100; // Add buffer for safety
        // Ensure we have enough tokens for the description (minimum 800 tokens for ~2000 chars)
        $data['generationConfig']['maxOutputTokens'] = max($estimatedMaxTokens, 800);
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60); // Increased timeout for description generation
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10); // Connection timeout
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        
        if ($curlError) {
            error_log("Gemini API cURL Error: " . $curlError);
            return $this->getErrorResponse('Failed to connect to Gemini API: ' . $curlError);
        }
        
        if ($httpCode === 200) {
            $responseData = json_decode($response, true);
            if (!$responseData) {
                error_log("Gemini API Error: Invalid JSON response - $response");
                return $this->getErrorResponse('Invalid response from Gemini API. Please try again.');
            }
            
            // Check for errors in response
            if (isset($responseData['error'])) {
                $errorMessage = $responseData['error']['message'] ?? 'Unknown error';
                error_log("Gemini API Error: " . $errorMessage);
                return $this->getErrorResponse('Gemini API error: ' . $errorMessage);
            }
            
            // Extract content from response
            $candidate = $responseData['candidates'][0] ?? null;
            if (!$candidate) {
                error_log("Gemini API Error: No candidates in response - " . json_encode($responseData));
                return $this->getErrorResponse('Gemini API returned no response. Please try again.');
            }
            
            // Check for finish reason
            $finishReason = $candidate['finishReason'] ?? null;
            if ($finishReason === 'MAX_TOKENS') {
                error_log("Gemini API Warning: Response hit MAX_TOKENS limit. Increasing token limit and retrying.");
                // Retry with increased token limit
                $data['generationConfig']['maxOutputTokens'] = 2000; // Increase significantly
                
                // Retry the request
                $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, $url);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'Content-Type: application/json'
                ]);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 60);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
                
                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                
                if ($httpCode === 200) {
                    $responseData = json_decode($response, true);
                    $candidate = $responseData['candidates'][0] ?? null;
                }
            }
            
            // Try to extract text content
            if (isset($candidate['content']['parts'][0]['text'])) {
                $generatedText = trim($candidate['content']['parts'][0]['text']);
                
                if (empty($generatedText)) {
                    error_log("Gemini API Error: Empty content in response");
                    return $this->getErrorResponse('Gemini API returned empty response. Please try again.');
                }
                
                // Clean up the generated text
                $description = $this->cleanGeneratedText($generatedText);
                
                return $description;
            } else {
                // Check if there's any partial content or alternative structure
                $errorMsg = 'Gemini API returned invalid response structure.';
                if ($finishReason) {
                    $errorMsg .= " Finish reason: {$finishReason}";
                }
                error_log("Gemini API Error: {$errorMsg} - " . json_encode($candidate));
                return $this->getErrorResponse($errorMsg . ' Please try again.');
            }
        } else {
            error_log("Gemini API Error: HTTP $httpCode - $response");
            $errorData = json_decode($response, true);
            if ($errorData && isset($errorData['error']['message'])) {
                $errorMessage = $errorData['error']['message'];
                return $this->getErrorResponse('Gemini API error: ' . $errorMessage);
            } else {
                return $this->getErrorResponse('Gemini API error: HTTP ' . $httpCode . '. Please check your API key and try again.');
            }
        }
    }
    
    /**
     * Clean generated text and validate length
     * Removes all markdown formatting to prevent AI-generated appearance
     */
    private function cleanGeneratedText($text) {
        // Remove markdown code blocks
        $text = preg_replace('/```[\w]*\n?/', '', $text);
        $text = preg_replace('/```\n?/', '', $text);
        
        // Remove markdown headers (# ## ###)
        $text = preg_replace('/^#{1,6}\s+/m', '', $text);
        
        // Remove markdown bold (**text** or __text__)
        $text = preg_replace('/\*\*([^*]+)\*\*/', '$1', $text);
        $text = preg_replace('/__([^_]+)__/', '$1', $text);
        
        // Remove markdown italic (*text* or _text_)
        $text = preg_replace('/\*([^*]+)\*/', '$1', $text);
        $text = preg_replace('/_([^_]+)_/', '$1', $text);
        
        // Remove markdown links [text](url)
        $text = preg_replace('/\[([^\]]+)\]\([^\)]+\)/', '$1', $text);
        
        // Remove markdown images ![alt](url)
        $text = preg_replace('/!\[([^\]]*)\]\([^\)]+\)/', '', $text);
        
        // Remove markdown lists (-, *, +)
        $text = preg_replace('/^[\s]*[-*+]\s+/m', '', $text);
        
        // Remove markdown numbered lists (1. 2. etc.)
        $text = preg_replace('/^\d+\.\s+/m', '', $text);
        
        // Remove markdown blockquotes (>)
        $text = preg_replace('/^>\s+/m', '', $text);
        
        // Remove markdown horizontal rules (---, ***, ___)
        $text = preg_replace('/^[-*_]{3,}\s*$/m', '', $text);
        
        // Remove markdown inline code (`code`)
        $text = preg_replace('/`([^`]+)`/', '$1', $text);
        
        // Remove excessive whitespace (multiple newlines become double newline)
        $text = preg_replace('/\n{3,}/', "\n\n", $text);
        
        // Remove leading/trailing whitespace from each line
        $text = preg_replace('/^[ \t]+|[ \t]+$/m', '', $text);
        
        // Trim overall whitespace
        $text = trim($text);
        
        // Ensure proper capitalization (first letter of first sentence)
        if (!empty($text)) {
            $text = ucfirst($text);
        }
        
        // Validate and truncate if necessary
        $maxChars = $this->config['limits']['description_length']['max_characters'] ?? 2500;
        if (strlen($text) > $maxChars) {
            // Truncate to max characters at word boundary
            $text = substr($text, 0, $maxChars);
            $lastSpace = strrpos($text, ' ');
            if ($lastSpace !== false) {
                $text = substr($text, 0, $lastSpace);
            }
            $text = rtrim($text, '.,!?;:') . '...';
        }
        
        return $text;
    }
    
    /**
     * Get error response
     */
    private function getErrorResponse($message) {
        error_log("Description Generator Error: " . $message);
        return "⚠️ " . $message . "\n\nPlease write a description manually or configure the Gemini API key.";
    }
    
    /**
     * Suggest product name based on image analysis using Gemini
     * Detects mismatch between product name and image, suggests better names
     */
    public function suggestProductName($currentName, $category, $imageAnalysis = null) {
        if (empty($this->apiKey)) {
            return $this->getBasicNameSuggestions($currentName, $category, $imageAnalysis);
        }
        
        if (!$imageAnalysis || empty($imageAnalysis['detected_objects']) || !$imageAnalysis['is_poultry_related']) {
            return $this->getBasicNameSuggestions($currentName, $category, $imageAnalysis);
        }
        
        try {
            $suggestedName = $this->generateNameWithGemini($currentName, $category, $imageAnalysis);
            if ($suggestedName && !isset($suggestedName['error'])) {
                return [
                    'suggested_name' => $suggestedName,
                    'has_mismatch' => $this->detectNameMismatch($currentName, $imageAnalysis),
                    'detected_items' => $imageAnalysis['detected_objects'] ?? [],
                    'image_category' => $imageAnalysis['category_suggestion'] ?? $category
                ];
            }
        } catch (Exception $e) {
            error_log("Product Name Suggestion Error: " . $e->getMessage());
        }
        
        return $this->getBasicNameSuggestions($currentName, $category, $imageAnalysis);
    }
    
    /**
     * Generate product name suggestion using Gemini
     */
    private function generateNameWithGemini($currentName, $category, $imageAnalysis) {
        $model = $this->config['services']['gemini']['text_model'] ?? 'gemini-2.5-flash';
        $temperature = 0.5; // Lower temperature for more consistent naming
        $apiKey = $this->apiKey;
        
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
        
        $detectedObjects = implode(', ', $imageAnalysis['detected_objects'] ?? []);
        $imageDescription = $imageAnalysis['image_description'] ?? '';
        $imageCategory = $imageAnalysis['category_suggestion'] ?? $category;
        
        $prompt = "You are an expert at creating product names for a poultry marketplace in Kenya.

CURRENT PRODUCT NAME: {$currentName}
CURRENT CATEGORY: {$category}
IMAGE ANALYSIS:
- Detected objects: {$detectedObjects}
- Image description: {$imageDescription}
- Suggested category from image: {$imageCategory}

TASK:
Generate a better, more accurate product name that matches what is shown in the image. The name should:
1. Accurately describe what is in the image (detected objects: {$detectedObjects})
2. Be concise (3-6 words maximum)
3. Include relevant keywords for the Kenyan poultry market
4. Be professional and clear
5. Match the category suggested by the image analysis

If the current name matches the image well, you can suggest a slightly improved version or the same name.
If there is a mismatch, suggest a name that accurately reflects the image content.

Respond with ONLY the suggested product name, nothing else. No explanations, no labels, just the name.";

        $data = [
            "contents" => [
                [
                    "parts" => [
                        [
                            "text" => $prompt
                        ]
                    ]
                ]
            ],
            "generationConfig" => [
                "temperature" => $temperature,
                "maxOutputTokens" => 50 // Short names only
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
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode === 200) {
            $responseData = json_decode($response, true);
            if (isset($responseData['candidates'][0]['content']['parts'][0]['text'])) {
                $suggestedName = trim($responseData['candidates'][0]['content']['parts'][0]['text']);
                // Remove quotes if present
                $suggestedName = trim($suggestedName, '"\'');
                return $suggestedName;
            }
        }
        
        return null;
    }
    
    /**
     * Detect if product name mismatches image content
     */
    private function detectNameMismatch($productName, $imageAnalysis) {
        if (!$imageAnalysis || empty($imageAnalysis['detected_objects'])) {
            return false;
        }
        
        $nameLower = strtolower($productName);
        $detectedObjects = array_map('strtolower', $imageAnalysis['detected_objects']);
        
        // Check if any detected object appears in the product name
        $hasMatch = false;
        foreach ($detectedObjects as $object) {
            // Check for partial matches (e.g., "chicken" matches "chickens", "chick")
            $objectWords = explode(' ', $object);
            foreach ($objectWords as $word) {
                if (strlen($word) > 3 && (strpos($nameLower, $word) !== false || strpos($word, $nameLower) !== false)) {
                    $hasMatch = true;
                    break 2;
                }
            }
        }
        
        // Also check category mismatch
        $nameCategory = $this->inferCategoryFromName($productName);
        $imageCategory = strtolower($imageAnalysis['category_suggestion'] ?? '');
        
        $categoryMismatch = false;
        if ($nameCategory && $imageCategory) {
            $categoryMap = [
                'chick' => ['live poultry', 'chickens'],
                'chicken' => ['live poultry', 'chickens'],
                'egg' => ['eggs'],
                'feed' => ['feed & nutrition'],
                'equipment' => ['equipment']
            ];
            
            $nameCategoryLower = strtolower($nameCategory);
            $expectedCategories = $categoryMap[$nameCategoryLower] ?? [];
            
            if (!empty($expectedCategories) && !in_array($imageCategory, $expectedCategories)) {
                $categoryMismatch = true;
            }
        }
        
        return !$hasMatch || $categoryMismatch;
    }
    
    /**
     * Infer category from product name
     */
    private function inferCategoryFromName($productName) {
        $nameLower = strtolower($productName);
        
        if (preg_match('/\b(chick|chicken|hen|rooster|broiler|layer|kienyeji)\b/', $nameLower)) {
            return 'chick';
        } elseif (preg_match('/\b(egg|eggs)\b/', $nameLower)) {
            return 'egg';
        } elseif (preg_match('/\b(feed|grain|seed|corn|wheat)\b/', $nameLower)) {
            return 'feed';
        } elseif (preg_match('/\b(equipment|cage|coop|feeder|waterer)\b/', $nameLower)) {
            return 'equipment';
        } elseif (preg_match('/\b(meat|chicken meat|poultry meat)\b/', $nameLower)) {
            return 'meat';
        }
        
        return null;
    }
    
    /**
     * Get basic name suggestions (fallback)
     */
    private function getBasicNameSuggestions($currentName, $category, $imageAnalysis) {
        $suggestions = [];
        
        // Basic validation
        if (strlen($currentName) < 3) {
            $suggestions[] = "Product name is too short. Consider adding more descriptive words.";
        }
        
        if (strlen($currentName) > 50) {
            $suggestions[] = "Product name is quite long. Consider shortening for better readability.";
        }
        
        // Image-based suggestions
        if ($imageAnalysis && !empty($imageAnalysis['detected_objects'])) {
            $detectedObjects = $imageAnalysis['detected_objects'];
            $suggestions[] = "Image shows: " . implode(', ', array_slice($detectedObjects, 0, 3));
        }
        
        return [
            'suggested_name' => null,
            'has_mismatch' => false,
            'detected_items' => $imageAnalysis['detected_objects'] ?? [],
            'image_category' => $imageAnalysis['category_suggestion'] ?? $category,
            'basic_suggestions' => $suggestions
        ];
    }
}
?>
