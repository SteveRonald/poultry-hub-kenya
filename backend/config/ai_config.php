<?php
// AI Configuration for KukuSoko
// Gemini (Google) - for image verification and description generation

return [
    'enabled' => true,
    'services' => [
        'gemini' => [
            'enabled' => true,
            'api_key' => getenv('GEMINI_API_KEY') ?: getenv('GOOGLE_API_KEY') ?: '', // Use environment variable
            'model' => 'gemini-2.5-flash', // Fast and efficient, or 'gemini-2.5-pro' for better quality
            'vision_model' => 'gemini-2.5-flash', // For image analysis (supports vision)
            'text_model' => 'gemini-2.5-flash', // For description generation
            'max_tokens' => 2000, // Gemini uses maxOutputTokens (increased for longer descriptions)
            'temperature' => 0.7, // Higher temperature for more creative descriptions
            'vision_temperature' => 0.1, // Lower temperature for strict image verification
            'features' => [
                'image_analysis' => true,
                'object_detection' => true,
                'poultry_verification' => true,
                'quality_assessment' => true,
                'description_generation' => true
            ]
        ],
        'openrouter' => [
            'enabled' => true,
            'api_key' => getenv('OPENROUTER_API_KEY') ?: '', // Use environment variable
            'model' => 'deepseek/deepseek-chat', // Free/low-cost model, or 'mistralai/mistral-7b-instruct' for alternative
            'base_url' => 'https://openrouter.ai/api/v1/chat/completions',
            'max_tokens' => 1000, // Reasonable limit for chat responses
            'temperature' => 0.7, // Balanced creativity
            'features' => [
                'general_chat' => true,
                'poultry_advice' => true,
                'farming_questions' => true
            ]
        ]
    ],
    'limits' => [
        'max_image_size' => 5242880, // 5MB
        'supported_formats' => ['jpg', 'jpeg', 'png', 'webp'],
        'description_length' => [
            'min_words' => 100, // Minimum words for SEO and comprehensiveness
            'max_words' => 400, // Maximum words to prevent overly long descriptions
            'optimal_min' => 150, // Optimal minimum for best SEO
            'optimal_max' => 300, // Optimal maximum for user engagement
            'max_characters' => 2500 // Maximum characters (approximately 400 words)
        ],
        'cache_duration' => 86400 // 24 hours (caching handled by OpenAI if needed)
    ],
    'image_verification' => [
        'required' => true, // Images must be verified before product creation
        'auto_verify_on_upload' => true, // Automatically verify images when uploaded
        'min_confidence' => 0.6, // Minimum confidence score (60%) for acceptance
        'reject_non_poultry' => true, // Reject images that are not poultry-related
        'allow_manual_override' => false, // Allow manual override when AI verification fails (for quota issues)
        'quota_error_mode' => 'reject' // 'reject' = reject upload, 'warn' = warn but allow, 'bypass' = skip verification
    ],
    'poultry_keywords' => [
        'chicken', 'poultry', 'bird', 'hen', 'rooster', 'chick', 'duck', 'goose', 'turkey',
        'egg', 'eggs', 'feed', 'grain', 'seed', 'corn', 'wheat', 'farm', 'farming',
        'livestock', 'animal', 'cage', 'coop', 'nest', 'feather', 'beak', 'wing',
        'meat', 'chicken meat', 'poultry meat', 'cooked chicken', 'broiler', 'layer',
        'kienyeji', 'indigenous', 'feeder', 'waterer', 'incubator', 'hatchery'
    ]
];
?>
