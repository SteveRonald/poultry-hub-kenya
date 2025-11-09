<?php
/**
 * Category Mapper
 * Maps AI-generated category suggestions to database category enum values
 */

/**
 * Map AI category suggestion to database category
 * 
 * @param string $aiCategory The category suggested by AI
 * @return string The database category enum value
 */
function mapAICategoryToDatabase($aiCategory) {
    $mapping = [
        // AI categories -> Database categories
        'Live Poultry' => 'chickens',
        'Poultry' => 'chickens',
        'Chickens' => 'chickens',
        'Chicken' => 'chickens',
        'Chicks' => 'chicks',
        'Eggs' => 'eggs',
        'Feed & Nutrition' => 'feed',
        'Feed' => 'feed',
        'Nutrition' => 'feed',
        'Equipment' => 'equipment',
        'Poultry Meat' => 'chickens', // Map to chickens since there's no meat category
        'Meat' => 'chickens',
        'Other' => 'other',
        'Medication' => 'medicine',
        'Medicine' => 'medicine'
    ];
    
    // Normalize the AI category (remove extra spaces, convert to title case)
    $normalized = trim($aiCategory);
    $normalized = ucwords(strtolower($normalized));
    
    // Check if we have a direct mapping
    if (isset($mapping[$normalized])) {
        return $mapping[$normalized];
    }
    
    // Check for partial matches
    foreach ($mapping as $aiKey => $dbValue) {
        if (stripos($normalized, $aiKey) !== false || stripos($aiKey, $normalized) !== false) {
            return $dbValue;
        }
    }
    
    // Default fallback
    return 'other';
}

/**
 * Get all valid database categories
 * 
 * @return array List of valid database category enum values
 */
function getValidDatabaseCategories() {
    return ['chickens', 'eggs', 'feed', 'equipment', 'medicine', 'chicks', 'other'];
}

/**
 * Validate if a category is valid for the database
 * 
 * @param string $category The category to validate
 * @return bool True if valid, false otherwise
 */
function isValidDatabaseCategory($category) {
    return in_array(strtolower($category), getValidDatabaseCategories());
}

/**
 * Normalize category from frontend to database format
 * 
 * @param string $category The category from frontend
 * @return string The normalized database category
 */
function normalizeCategory($category) {
    if (empty($category)) {
        return 'other';
    }
    
    $category = strtolower(trim($category));
    
    // Map frontend categories to database categories
    $frontendToDb = [
        'medication' => 'medicine',
        'chicken' => 'chickens',
        'chick' => 'chicks',
        'live poultry' => 'chickens',
        'poultry' => 'chickens',
        'feed & nutrition' => 'feed',
        'poultry meat' => 'chickens', // Map to chickens since there's no meat category
        'meat' => 'chickens'
    ];
    
    if (isset($frontendToDb[$category])) {
        return $frontendToDb[$category];
    }
    
    // If it's already a valid database category, return it
    if (isValidDatabaseCategory($category)) {
        return $category;
    }
    
    // Try mapping using AI category mapper
    $mapped = mapAICategoryToDatabase($category);
    if (isValidDatabaseCategory($mapped)) {
        return $mapped;
    }
    
    // Default to 'other'
    return 'other';
}
?>

