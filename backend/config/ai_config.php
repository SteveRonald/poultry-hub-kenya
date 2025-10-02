<?php
// AI Configuration for Poultry Hub Kenya
// Free tier services only

return [
    'enabled' => true,
    'services' => [
        'google_vision' => [
            'enabled' => true,
            'api_key' => 'AIzaSyBd7ONavOysjBomwNVzPw5bUywntKxrWzc', // You'll need to get this from Google Cloud Console
            'free_tier_limit' => 1000, // requests per month
            'features' => [
                'image_quality' => true,
                'object_detection' => true,
                'content_moderation' => true,
                'text_detection' => true
            ]
        ],
        'hugging_face' => [
            'enabled' => true,
            'api_key' => '', // Optional - works without API key for basic models
            'models' => [
                'description_generation' => 'microsoft/DialoGPT-medium',
                'text_classification' => 'distilbert-base-uncased-finetuned-sst-2-english',
                'content_moderation' => 'unitary/toxic-bert'
            ]
        ],
        'roboflow' => [
            'enabled' => false, // Disabled - using OpenAI instead
            'api_key' => 'rf_Rk1J2jFOOeQkIAVxbYjbKMTQfTe2', // Get this from Roboflow dashboard
            'project_id' => 'svb73', // Your custom poultry model project ID
            'model_version' => '1', // Model version number
            'free_tier_limit' => 1000, // predictions per month
            'features' => [
                'custom_poultry_detection' => true,
                'object_detection' => true,
                'confidence_scoring' => true,
                'real_time_inference' => true
            ]
        ],
        'openai_vision' => [
            'enabled' => false, // Disabled - not free
            'api_key' => '', // Get this from OpenAI dashboard
            'model' => 'gpt-4o', // GPT-4 Vision model
            'max_tokens' => 500,
            'temperature' => 0.1,
            'features' => [
                'image_analysis' => true,
                'object_detection' => true,
                'content_moderation' => true,
                'quality_assessment' => true,
                'poultry_detection' => true
            ]
        ],
        'hugging_face_vision' => [
            'enabled' => true, // FREE - no API key needed
            'api_key' => '', // Optional - works without API key
            'models' => [
                'image_classification' => 'microsoft/resnet-50',
                'object_detection' => 'facebook/detr-resnet-50',
                'poultry_detection' => 'google/vit-base-patch16-224'
            ],
            'features' => [
                'image_analysis' => true,
                'object_detection' => true,
                'content_moderation' => true,
                'quality_assessment' => true,
                'poultry_detection' => true
            ]
        ]
    ],
    'fallback' => [
        'enabled' => true,
        'use_basic_analysis' => true, // Fallback to basic PHP analysis if AI fails
        'cache_results' => true // Cache AI results to reduce API calls
    ],
    'limits' => [
        'max_image_size' => 5242880, // 5MB
        'supported_formats' => ['jpg', 'jpeg', 'png', 'webp'],
        'max_description_length' => 500,
        'cache_duration' => 86400 // 24 hours
    ]
];
?>
