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
