<?php
// AI Services API endpoints
// Non-intrusive AI features for product enhancement

// Suppress warnings to prevent JSON corruption
error_reporting(E_ERROR | E_PARSE);
ini_set('display_errors', 0);

require_once __DIR__ . '/../services/ai/ImageAnalyzer.php';
require_once __DIR__ . '/../services/ai/DescriptionGenerator.php';
require_once __DIR__ . '/../services/ai/ContentModerator.php';

/**
 * Analyze uploaded image
 */
function handleImageAnalysis() {
    try {
        // Handle both JSON and form data
        $input = null;
        $imageUrl = null;
        
        // Check if it's JSON data
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (strpos($contentType, 'application/json') !== false) {
            $input = json_decode(file_get_contents('php://input'), true);
            $imageUrl = $input['image_url'] ?? null;
        } else {
            // Handle form data
            $imageUrl = $_POST['image_url'] ?? null;
        }
        
        if (!$imageUrl && !isset($_FILES['image'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Image URL or file is required']);
            return;
        }
        
        $analyzer = new ImageAnalyzer();
        
        if ($imageUrl) {
            $analysis = $analyzer->analyzeImage('', $imageUrl);
        } else {
            // Handle uploaded file
            $uploadedFile = $_FILES['image'];
            if ($uploadedFile['error'] !== UPLOAD_ERR_OK) {
                http_response_code(400);
                echo json_encode(['error' => 'File upload failed']);
                return;
            }
            
            $analysis = $analyzer->analyzeImage($uploadedFile['tmp_name']);
        }
        
        echo json_encode([
            'success' => true,
            'analysis' => $analysis
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        error_log("Image Analysis Error: " . $e->getMessage());
        echo json_encode(['error' => 'Image analysis failed: ' . $e->getMessage()]);
    }
}

/**
 * Generate product description
 */
function handleDescriptionGeneration() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['product_name']) || !isset($input['category'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Product name and category are required']);
        return;
    }
    
    try {
        $generator = new DescriptionGenerator();
        
        $description = $generator->generateDescription(
            $input['product_name'],
            $input['category'],
            $input['image_analysis'] ?? null,
            $input['additional_info'] ?? []
        );
        
        $nameSuggestions = $generator->suggestProductName(
            $input['product_name'],
            $input['category'],
            $input['image_analysis'] ?? null
        );
        
        echo json_encode([
            'success' => true,
            'description' => $description,
            'name_suggestions' => $nameSuggestions
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        error_log("Description Generation Error: " . $e->getMessage());
        echo json_encode(['error' => 'Description generation failed: ' . $e->getMessage()]);
    }
}

/**
 * Moderate product content
 */
function handleContentModeration() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['product_name']) || !isset($input['description'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Product name and description are required']);
        return;
    }
    
    try {
        $moderator = new ContentModerator();
        
        $moderation = $moderator->moderateContent(
            $input['product_name'],
            $input['description'],
            $input['image_analysis'] ?? null
        );
        
        $summary = $moderator->getModerationSummary($moderation);
        
        echo json_encode([
            'success' => true,
            'moderation' => $moderation,
            'summary' => $summary
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        error_log("Content Moderation Error: " . $e->getMessage());
        echo json_encode(['error' => 'Content moderation failed: ' . $e->getMessage()]);
    }
}

/**
 * Get AI suggestions for product improvement
 */
function handleProductSuggestions() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['product_name']) || !isset($input['category'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Product name and category are required']);
        return;
    }
    
    try {
        $suggestions = [
            'image_suggestions' => [],
            'name_suggestions' => [],
            'description_suggestions' => [],
            'category_suggestions' => [],
            'overall_score' => 0
        ];
        
        // Image analysis if provided
        if (isset($input['image_analysis'])) {
            $imageAnalysis = $input['image_analysis'];
            
            if (isset($imageAnalysis['suggestions'])) {
                $suggestions['image_suggestions'] = $imageAnalysis['suggestions'];
            }
            
            if (isset($imageAnalysis['quality_score'])) {
                $suggestions['overall_score'] += $imageAnalysis['quality_score'] * 0.4; // 40% weight
            }
            
            if (isset($imageAnalysis['category_suggestion'])) {
                $suggestions['category_suggestions'][] = $imageAnalysis['category_suggestion'];
            }
        }
        
        // Name suggestions
        $generator = new DescriptionGenerator();
        $nameSuggestions = $generator->suggestProductName(
            $input['product_name'],
            $input['category'],
            $input['image_analysis'] ?? null
        );
        $suggestions['name_suggestions'] = $nameSuggestions;
        
        // Description suggestions
        if (isset($input['description'])) {
            $descriptionSuggestions = [];
            
            if (strlen($input['description']) < 50) {
                $descriptionSuggestions[] = 'Consider adding more details to your description';
            }
            
            if (strlen($input['description']) > 500) {
                $descriptionSuggestions[] = 'Description might be too long, consider shortening';
            }
            
            if (!preg_match('/\b(quality|fresh|healthy|premium)\b/i', $input['description'])) {
                $descriptionSuggestions[] = 'Consider adding quality descriptors like "fresh", "healthy", or "premium"';
            }
            
            $suggestions['description_suggestions'] = $descriptionSuggestions;
            $suggestions['overall_score'] += min(strlen($input['description']) / 10, 5) * 0.3; // 30% weight
        }
        
        // Category suggestions
        $categoryKeywords = [
            'Live Poultry' => ['chicken', 'poultry', 'bird', 'hen', 'rooster'],
            'Eggs' => ['egg', 'fresh', 'organic', 'free-range'],
            'Feed & Nutrition' => ['feed', 'nutrition', 'poultry', 'chicken'],
            'Equipment' => ['equipment', 'tool', 'device', 'system']
        ];
        
        $currentCategory = $input['category'];
        $nameLower = strtolower($input['product_name']);
        
        foreach ($categoryKeywords as $category => $keywords) {
            if ($category !== $currentCategory) {
                foreach ($keywords as $keyword) {
                    if (strpos($nameLower, $keyword) !== false) {
                        $suggestions['category_suggestions'][] = "Consider category: $category";
                        break;
                    }
                }
            }
        }
        
        // Calculate overall score
        $suggestions['overall_score'] = min($suggestions['overall_score'], 10);
        
        echo json_encode([
            'success' => true,
            'suggestions' => $suggestions
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        error_log("Product Suggestions Error: " . $e->getMessage());
        echo json_encode(['error' => 'Product suggestions failed: ' . $e->getMessage()]);
    }
}

/**
 * Get AI configuration status
 */
function handleAIConfig() {
    $config = require __DIR__ . '/../config/ai_config.php';
    
    // Don't expose API keys
    $publicConfig = [
        'enabled' => $config['enabled'],
        'services' => [
            'google_vision' => [
                'enabled' => $config['services']['google_vision']['enabled'],
                'has_api_key' => !empty($config['services']['google_vision']['api_key']),
                'free_tier_limit' => $config['services']['google_vision']['free_tier_limit']
            ],
            'hugging_face' => [
                'enabled' => $config['services']['hugging_face']['enabled'],
                'has_api_key' => !empty($config['services']['hugging_face']['api_key'])
            ]
        ],
        'fallback' => $config['fallback'],
        'limits' => $config['limits']
    ];
    
    echo json_encode([
        'success' => true,
        'config' => $publicConfig
    ]);
}
?>

