<?php
// AI Configuration for Poultry Hub Kenya
// Free tier services only

return [
    'enabled' => true,
    'services' => [
        // Keep only OpenAI and Hugging Face services
        'openai_vision' => [
            'enabled' => true,
            'api_key' => getenv('OPENAI_API_KEY') ?: '',
            'model' => 'gpt-4o',
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
        'hugging_face' => [
            'enabled' => true,
            'api_key' => getenv('HUGGING_FACE_API_KEY') ?: '',
            'models' => [
                'assistant_dialog' => 'microsoft/DialoGPT-medium',
                'text_classification' => 'distilbert-base-uncased-finetuned-sst-2-english',
                'content_moderation' => 'unitary/toxic-bert'
            ]
        ],
        'hugging_face_vision' => [
            'enabled' => true,
            'api_key' => getenv('HUGGING_FACE_API_KEY') ?: '',
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
