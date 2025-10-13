<?php
// AI Image Analysis Service
// Uses Hugging Face Vision with fallback analysis

class ImageAnalyzer {
    private $config;
    private $cache;
    
    public function __construct() {
        $this->config = require __DIR__ . '/../../config/ai_config.php';
        $this->cache = [];
    }
    
    /**
     * Analyze image quality and content
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
            'analysis_method' => 'fallback'
        ];
        
        try {
            // Use Hugging Face Vision for image analysis
            if ($analysis['analysis_method'] === 'fallback' && $this->config['services']['hugging_face_vision']['enabled']) {
                $huggingFaceAnalysis = $this->analyzeWithHuggingFaceVision($imageUrl ?? $imagePath);
                if ($huggingFaceAnalysis) {
                    $analysis = array_merge($analysis, $huggingFaceAnalysis);
                    $analysis['analysis_method'] = 'hugging_face_vision';
                }
            }
            
            // Fallback to basic analysis
            if ($analysis['analysis_method'] === 'fallback') {
                $analysis = array_merge($analysis, $this->basicImageAnalysis($imagePath));
            }
            
            // Cache the result
            if ($this->config['fallback']['cache_results']) {
                $this->cache[$cacheKey] = $analysis;
            }
            
        } catch (Exception $e) {
            error_log("AI Image Analysis Error: " . $e->getMessage());
            $analysis = array_merge($analysis, $this->basicImageAnalysis($imagePath));
        }
        
        return $analysis;
    }
    
    /**
     * Google Cloud Vision API analysis
     */
    // Removed Google Vision integration; using OpenAI and Hugging Face only
    private function analyzeWithGoogleVision($imageSource) {
        return null;
    }
    
    /**
     * Hugging Face Vision API analysis
     */
    private function analyzeWithHuggingFaceVision($imageSource) {
        // Use Hugging Face's image classification models
        $models = [
            'microsoft/resnet-50', // General object detection
            'google/vit-base-patch16-224', // Vision transformer
            'facebook/deit-base-patch16-224' // Efficient image transformer
        ];
        
        $allResults = [];
        
        foreach ($models as $model) {
            $url = "https://api-inference.huggingface.co/models/$model";
            
            // Prepare image data
            if (filter_var($imageSource, FILTER_VALIDATE_URL)) {
                $imageData = file_get_contents($imageSource);
                if ($imageData === false) continue;
            } else {
                $imageData = file_get_contents($imageSource);
                if ($imageData === false) continue;
            }
            
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $imageData);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: image/jpeg',
                'Authorization: Bearer ' . ($this->config['services']['hugging_face']['api_key'] ?? '')
            ]);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($httpCode === 200) {
                $data = json_decode($response, true);
                if ($data && is_array($data)) {
                    $allResults = array_merge($allResults, $data);
                }
            }
        }
        
        if (empty($allResults)) {
            return null;
        }
        
        // Process the results
        $analysis = [
            'quality_score' => $this->calculateQualityScoreFromHF($allResults),
            'detected_objects' => $this->extractObjectsFromHF($allResults),
            'suggestions' => $this->generateSuggestionsFromHF($allResults),
            'inappropriate_content' => $this->checkInappropriateContentFromHF($allResults),
            'category_suggestion' => $this->suggestCategoryFromHF($allResults),
            'confidence' => $this->calculateConfidenceFromHF($allResults),
            'is_poultry_related' => $this->isPoultryRelatedFromHF($allResults)
        ];
        
        return $analysis;
    }
    
    /**
     * Basic image analysis fallback
     */
    private function basicImageAnalysis($imagePath) {
        // For uploaded images in poultry marketplace, assume they're poultry-related
        $filename = basename($imagePath);
        
        if (!file_exists($imagePath)) {
            return [
                'quality_score' => 5, // Give a reasonable score for uploaded images
                'detected_objects' => ['poultry'], // Assume poultry content
                'suggestions' => ['Image uploaded successfully'],
                'inappropriate_content' => false,
                'category_suggestion' => $this->suggestCategoryFromFilename($filename),
                'confidence' => 0.7,
                'is_poultry_related' => $this->isPoultryRelatedFromFilename($filename)
            ];
        }
        
        $imageInfo = getimagesize($imagePath);
        if (!$imageInfo) {
            return [
                'quality_score' => 2,
                'detected_objects' => [],
                'suggestions' => ['Invalid image format'],
                'inappropriate_content' => false,
                'category_suggestion' => 'Unknown',
                'confidence' => 0.2,
                'is_poultry_related' => false
            ];
        }
        
        $width = $imageInfo[0];
        $height = $imageInfo[1];
        $fileSize = filesize($imagePath);
        
        // Basic quality scoring
        $qualityScore = 5; // Base score
        
        // Size scoring
        if ($width >= 800 && $height >= 600) $qualityScore += 2;
        elseif ($width >= 400 && $height >= 300) $qualityScore += 1;
        
        // File size scoring
        if ($fileSize > 100000 && $fileSize < 2000000) $qualityScore += 1;
        elseif ($fileSize > 2000000) $qualityScore += 2;
        
        // Generate basic suggestions
        $suggestions = [];
        if ($width < 400 || $height < 300) {
            $suggestions[] = 'Consider using a higher resolution image';
        }
        if ($fileSize < 50000) {
            $suggestions[] = 'Image quality might be too low';
        }
        if ($fileSize > 5000000) {
            $suggestions[] = 'Image file is very large, consider compressing';
        }
        
        // Basic object detection based on filename and image properties
        $detectedObjects = [];
        $filename = strtolower(basename($imagePath));
        
        // Check filename for poultry keywords
        $poultryKeywords = ['chicken', 'poultry', 'hen', 'rooster', 'chick', 'duck', 'goose', 'turkey', 'bird'];
        $eggKeywords = ['egg', 'eggs'];
        $feedKeywords = ['feed', 'grain', 'seed', 'corn', 'wheat'];
        
        foreach ($poultryKeywords as $keyword) {
            if (strpos($filename, $keyword) !== false) {
                $detectedObjects[] = 'poultry';
                break;
            }
        }
        
        foreach ($eggKeywords as $keyword) {
            if (strpos($filename, $keyword) !== false) {
                $detectedObjects[] = 'eggs';
                break;
            }
        }
        
        foreach ($feedKeywords as $keyword) {
            if (strpos($filename, $keyword) !== false) {
                $detectedObjects[] = 'feed';
                break;
            }
        }
        
        // If no objects detected from filename, assume it's poultry-related for uploaded images
        // This is because we're in a poultry marketplace context
        if (empty($detectedObjects)) {
            $detectedObjects[] = 'poultry'; // Assume poultry content in poultry marketplace
        }
        
        return [
            'quality_score' => min($qualityScore, 10),
            'detected_objects' => $detectedObjects,
            'suggestions' => $suggestions,
            'inappropriate_content' => false,
            'category_suggestion' => $this->suggestCategoryFromFilename($filename),
            'confidence' => 0.6,
            'is_poultry_related' => $this->isPoultryRelatedFromFilename($filename)
        ];
    }
    
    /**
     * Calculate quality score from Google Vision response
     */
    private function calculateQualityScore($response) {
        $score = 5; // Base score
        
        // Check for labels (more labels = better description)
        if (isset($response['labelAnnotations'])) {
            $score += min(count($response['labelAnnotations']) * 0.5, 3);
        }
        
        // Check for text detection
        if (isset($response['textAnnotations']) && !empty($response['textAnnotations'])) {
            $score += 1;
        }
        
        // Check for objects
        if (isset($response['localizedObjectAnnotations'])) {
            $score += min(count($response['localizedObjectAnnotations']) * 0.3, 2);
        }
        
        return min($score, 10);
    }
    
    /**
     * Extract objects from Google Vision response
     */
    private function extractObjects($response) {
        $objects = [];
        
        if (isset($response['labelAnnotations'])) {
            foreach ($response['labelAnnotations'] as $label) {
                if ($label['score'] > 0.7) { // High confidence labels only
                    $objects[] = strtolower($label['description']);
                }
            }
        }
        
        if (isset($response['localizedObjectAnnotations'])) {
            foreach ($response['localizedObjectAnnotations'] as $object) {
                if ($object['score'] > 0.7) {
                    $objects[] = strtolower($object['name']);
                }
            }
        }
        
        return array_unique($objects);
    }
    
    /**
     * Generate suggestions based on analysis
     */
    private function generateSuggestions($response) {
        $suggestions = [];
        
        // Check image quality indicators
        if (isset($response['labelAnnotations'])) {
            $labels = array_column($response['labelAnnotations'], 'description');
            
            if (in_array('blur', $labels) || in_array('dark', $labels)) {
                $suggestions[] = 'Consider taking a clearer, well-lit photo';
            }
            
            if (in_array('close-up', $labels)) {
                $suggestions[] = 'Great close-up shot! Consider adding a wider angle view too';
            }
        }
        
        // General suggestions
        $suggestions[] = 'Make sure the product is clearly visible';
        $suggestions[] = 'Consider showing the product from multiple angles';
        
        return $suggestions;
    }
    
    /**
     * Check for inappropriate content
     */
    private function checkInappropriateContent($response) {
        if (isset($response['safeSearchAnnotation'])) {
            $safeSearch = $response['safeSearchAnnotation'];
            $inappropriate = ['LIKELY', 'VERY_LIKELY'];
            
            return in_array($safeSearch['adult'], $inappropriate) ||
                   in_array($safeSearch['violence'], $inappropriate) ||
                   in_array($safeSearch['racy'], $inappropriate);
        }
        
        return false;
    }
    
    /**
     * Check if image is poultry-related
     */
    private function isPoultryRelated($response) {
        $poultryKeywords = [
            'chicken', 'poultry', 'bird', 'hen', 'rooster', 'chick', 'duck', 'goose', 'turkey',
            'egg', 'eggs', 'feed', 'grain', 'seed', 'corn', 'wheat', 'farm', 'farming',
            'livestock', 'animal', 'cage', 'coop', 'nest', 'feather', 'beak', 'wing'
        ];
        
        $allObjects = [];
        if (isset($response['labelAnnotations'])) {
            $allObjects = array_merge($allObjects, array_column($response['labelAnnotations'], 'description'));
        }
        if (isset($response['localizedObjectAnnotations'])) {
            $allObjects = array_merge($allObjects, array_column($response['localizedObjectAnnotations'], 'name'));
        }
        
        $allObjects = array_map('strtolower', $allObjects);
        
        foreach ($allObjects as $object) {
            foreach ($poultryKeywords as $keyword) {
                if (strpos($object, $keyword) !== false) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Suggest category based on detected objects
     */
    private function suggestCategory($response) {
        $poultryKeywords = ['chicken', 'poultry', 'bird', 'rooster', 'hen', 'chick'];
        $eggKeywords = ['egg', 'eggs'];
        $feedKeywords = ['feed', 'food', 'grain', 'seed'];
        
        $allObjects = [];
        if (isset($response['labelAnnotations'])) {
            $allObjects = array_merge($allObjects, array_column($response['labelAnnotations'], 'description'));
        }
        if (isset($response['localizedObjectAnnotations'])) {
            $allObjects = array_merge($allObjects, array_column($response['localizedObjectAnnotations'], 'name'));
        }
        
        $allObjects = array_map('strtolower', $allObjects);
        
        foreach ($allObjects as $object) {
            if (array_intersect(explode(' ', $object), $poultryKeywords)) {
                return 'Live Poultry';
            }
            if (array_intersect(explode(' ', $object), $eggKeywords)) {
                return 'Eggs';
            }
            if (array_intersect(explode(' ', $object), $feedKeywords)) {
                return 'Feed & Nutrition';
            }
        }
        
        return 'Other';
    }
    
    /**
     * Calculate confidence score
     */
    private function calculateConfidence($response) {
        $confidence = 0;
        $count = 0;
        
        if (isset($response['labelAnnotations'])) {
            foreach ($response['labelAnnotations'] as $label) {
                $confidence += $label['score'];
                $count++;
            }
        }
        
        return $count > 0 ? $confidence / $count : 0.5;
    }
    
    /**
     * Suggest category from filename
     */
    private function suggestCategoryFromFilename($filename) {
        $filenameLower = strtolower($filename);
        
        // Check for specific poultry types
        $poultryKeywords = ['chicken', 'poultry', 'hen', 'rooster', 'chick', 'duck', 'goose', 'turkey', 'bird'];
        foreach ($poultryKeywords as $keyword) {
            if (strpos($filenameLower, $keyword) !== false) {
                return 'Live Poultry';
            }
        }
        
        // Check for eggs
        if (strpos($filenameLower, 'egg') !== false) {
            return 'Eggs';
        }
        
        // Check for feed/nutrition
        $feedKeywords = ['feed', 'grain', 'seed', 'corn', 'wheat', 'nutrition'];
        foreach ($feedKeywords as $keyword) {
            if (strpos($filenameLower, $keyword) !== false) {
                return 'Feed & Nutrition';
            }
        }
        
        // Check for equipment
        $equipmentKeywords = ['cage', 'coop', 'equipment', 'tool', 'device'];
        foreach ($equipmentKeywords as $keyword) {
            if (strpos($filenameLower, $keyword) !== false) {
                return 'Equipment';
            }
        }
        
        // Default to Live Poultry for poultry marketplace context
        return 'Live Poultry';
    }
    
    /**
     * Check if filename suggests poultry-related content
     */
    private function isPoultryRelatedFromFilename($filename) {
        $poultryKeywords = [
            'chicken', 'poultry', 'bird', 'hen', 'rooster', 'chick', 'duck', 'goose', 'turkey',
            'egg', 'eggs', 'feed', 'grain', 'seed', 'corn', 'wheat', 'farm', 'farming',
            'livestock', 'animal', 'cage', 'coop', 'nest', 'feather', 'beak', 'wing'
        ];
        
        $filenameLower = strtolower($filename);
        foreach ($poultryKeywords as $keyword) {
            if (strpos($filenameLower, $keyword) !== false) {
                return true;
            }
        }
        
        // For uploaded images in a poultry marketplace, assume they're poultry-related
        // unless they have obvious non-poultry keywords
        $nonPoultryKeywords = ['car', 'house', 'person', 'dog', 'cat', 'tree', 'flower', 'food', 'drink'];
        foreach ($nonPoultryKeywords as $keyword) {
            if (strpos($filenameLower, $keyword) !== false) {
                return false;
            }
        }
        
        // Default to true for poultry marketplace context
        return true;
    }
    
    /**
     * Calculate quality score from Hugging Face results
     */
    private function calculateQualityScoreFromHF($results) {
        $score = 5; // Base score
        
        // Higher confidence results = better quality
        foreach ($results as $result) {
            if (isset($result['score']) && $result['score'] > 0.7) {
                $score += 2;
            } elseif (isset($result['score']) && $result['score'] > 0.5) {
                $score += 1;
            }
        }
        
        return min($score, 10);
    }
    
    /**
     * Extract objects from Hugging Face results
     */
    private function extractObjectsFromHF($results) {
        $objects = [];
        
        foreach ($results as $result) {
            if (isset($result['label']) && isset($result['score']) && $result['score'] > 0.3) {
                $objects[] = strtolower($result['label']);
            }
        }
        
        return array_unique($objects);
    }
    
    /**
     * Generate suggestions from Hugging Face results
     */
    private function generateSuggestionsFromHF($results) {
        $suggestions = [];
        
        // Check for common issues
        $lowConfidence = true;
        foreach ($results as $result) {
            if (isset($result['score']) && $result['score'] > 0.7) {
                $lowConfidence = false;
                break;
            }
        }
        
        if ($lowConfidence) {
            $suggestions[] = 'Image quality could be improved for better analysis';
        }
        
        $suggestions[] = 'Make sure the product is clearly visible';
        $suggestions[] = 'Consider taking photos in good lighting';
        
        return $suggestions;
    }
    
    /**
     * Check for inappropriate content from Hugging Face results
     */
    private function checkInappropriateContentFromHF($results) {
        $inappropriateKeywords = ['adult', 'violence', 'weapon', 'drug', 'alcohol'];
        
        foreach ($results as $result) {
            if (isset($result['label'])) {
                $label = strtolower($result['label']);
                foreach ($inappropriateKeywords as $keyword) {
                    if (strpos($label, $keyword) !== false) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    /**
     * Suggest category from Hugging Face results
     */
    private function suggestCategoryFromHF($results) {
        $poultryKeywords = ['chicken', 'poultry', 'bird', 'hen', 'rooster', 'chick', 'duck', 'goose', 'turkey'];
        $eggKeywords = ['egg', 'eggs'];
        $feedKeywords = ['feed', 'grain', 'seed', 'corn', 'wheat', 'food'];
        $meatKeywords = ['meat', 'chicken meat', 'poultry meat', 'cooked chicken'];
        
        foreach ($results as $result) {
            if (isset($result['label']) && isset($result['score']) && $result['score'] > 0.5) {
                $label = strtolower($result['label']);
                
                // Check for meat products
                foreach ($meatKeywords as $keyword) {
                    if (strpos($label, $keyword) !== false) {
                        return 'Poultry Meat';
                    }
                }
                
                // Check for live poultry
                foreach ($poultryKeywords as $keyword) {
                    if (strpos($label, $keyword) !== false) {
                        return 'Live Poultry';
                    }
                }
                
                // Check for eggs
                foreach ($eggKeywords as $keyword) {
                    if (strpos($label, $keyword) !== false) {
                        return 'Eggs';
                    }
                }
                
                // Check for feed
                foreach ($feedKeywords as $keyword) {
                    if (strpos($label, $keyword) !== false) {
                        return 'Feed & Nutrition';
                    }
                }
            }
        }
        
        return 'Live Poultry'; // Default
    }
    
    /**
     * Calculate confidence from Hugging Face results
     */
    private function calculateConfidenceFromHF($results) {
        $totalConfidence = 0;
        $count = 0;
        
        foreach ($results as $result) {
            if (isset($result['score'])) {
                $totalConfidence += $result['score'];
                $count++;
            }
        }
        
        return $count > 0 ? $totalConfidence / $count : 0.5;
    }
    
    /**
     * Check if poultry-related from Hugging Face results
     */
    private function isPoultryRelatedFromHF($results) {
        $poultryKeywords = [
            'chicken', 'poultry', 'bird', 'hen', 'rooster', 'chick', 'duck', 'goose', 'turkey',
            'egg', 'eggs', 'feed', 'grain', 'seed', 'corn', 'wheat', 'farm', 'farming',
            'livestock', 'animal', 'cage', 'coop', 'nest', 'feather', 'beak', 'wing',
            'meat', 'chicken meat', 'poultry meat', 'cooked chicken'
        ];
        
        foreach ($results as $result) {
            if (isset($result['label']) && isset($result['score']) && $result['score'] > 0.3) {
                $label = strtolower($result['label']);
                foreach ($poultryKeywords as $keyword) {
                    if (strpos($label, $keyword) !== false) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
}
?>
