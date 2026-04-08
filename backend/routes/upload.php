<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../services/ai/ImageAnalyzer.php';

function getVerificationUiMessage($status, $analysis = null, $verifiedConfidence = 0.6) {
    if ($status === 'caution') {
        return 'AI verification is not fully certain, but this product may be relevant to poultry farming. It can continue for manual review.';
    }

    if ($status === 'rejected') {
        return $analysis['rejection_reason'] ?? 'This image appears to be outside the poultry farming marketplace scope.';
    }

    return 'Image verified successfully.';
}

function buildAnalysisText($analysis) {
    $parts = [];
    if (!empty($analysis['detected_objects']) && is_array($analysis['detected_objects'])) {
        $parts[] = implode(' ', $analysis['detected_objects']);
    }
    if (!empty($analysis['image_description']) && is_string($analysis['image_description'])) {
        $parts[] = $analysis['image_description'];
    }
    return strtolower(trim(implode(' ', $parts)));
}

function hasAnyKeyword($text, $keywords) {
    foreach ($keywords as $keyword) {
        if ($keyword !== '' && strpos($text, strtolower($keyword)) !== false) {
            return true;
        }
    }
    return false;
}

function classifyVerificationResult($analysis, $config) {
    $verifiedConfidence = $config['image_verification']['min_confidence'] ?? 0.62;
    $reviewConfidence = $config['image_verification']['review_confidence'] ?? 0.35;
    $rejectConfidence = $config['image_verification']['reject_confidence'] ?? 0.8;
    $isPoultryRelated = $analysis['is_poultry_related'] ?? false;
    $confidence = (float)($analysis['confidence'] ?? 0);
    $relevanceStatus = $analysis['relevance_status'] ?? null;
    $text = buildAnalysisText($analysis);
    $poultryKeywords = $config['poultry_keywords'] ?? [];
    $supportiveKeywords = [
        'boot', 'boots', 'gumboot', 'gumboots', 'rubber boot', 'work boot', 'footwear',
        'glove', 'gloves', 'overall', 'overalls', 'protective', 'safety',
        'disinfectant', 'sanitizer', 'cleaning', 'brush', 'broom', 'shovel',
        'farm tool', 'equipment', 'barn', 'coop', 'hatchery'
    ];
    $hardRejectKeywords = [
        'television', 'tv', 'phone', 'smartphone', 'laptop', 'headphone', 'earphone',
        'watch', 'handbag', 'shoe fashion', 'lipstick', 'makeup', 'jewelry', 'sofa',
        'blender', 'kettle', 'microwave'
    ];

    $hasPoultrySignal = hasAnyKeyword($text, $poultryKeywords) || hasAnyKeyword($text, $supportiveKeywords);
    $hasHardRejectSignal = hasAnyKeyword($text, $hardRejectKeywords);

    if ($isPoultryRelated && $confidence >= $verifiedConfidence && $relevanceStatus !== 'borderline_match') {
        return 'verified';
    }

    if ($isPoultryRelated && ($confidence >= $reviewConfidence || $relevanceStatus === 'borderline_match')) {
        return 'caution';
    }

    if ($hasHardRejectSignal && ($confidence >= max(0.55, $reviewConfidence) || $relevanceStatus === 'out_of_scope')) {
        return 'rejected';
    }

    if ($hasPoultrySignal && $confidence >= max(0.25, $reviewConfidence - 0.05)) {
        return 'caution';
    }

    if (!$isPoultryRelated && $confidence >= $rejectConfidence) {
        return 'rejected';
    }

    if ($confidence >= $reviewConfidence) {
        return 'caution';
    }

    return 'rejected';
}

function handleImageUpload() {
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    
    if (!isset($_FILES['image'])) {
        http_response_code(400);
        echo json_encode(['error' => 'No image file provided']);
        return;
    }
    
    $file = $_FILES['image'];
    
    // Validate file
    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'File upload error']);
        return;
    }
    
    // Check file size (max 5MB)
    if ($file['size'] > 5 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['error' => 'File too large. Maximum size is 5MB']);
        return;
    }
    
    // Check file type with multiple validation methods
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    // Check MIME type
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    
    // Check file extension
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    
    // Validate both MIME type and extension
    if (!in_array($mimeType, $allowedTypes) || !in_array($extension, $allowedExtensions)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed']);
        return;
    }
    
    // Additional security: Check file header
    $fileHeader = file_get_contents($file['tmp_name'], false, null, 0, 10);
    $validHeaders = [
        "\xFF\xD8\xFF", // JPEG
        "\x89PNG\r\n\x1a\n", // PNG
        "GIF87a", // GIF87a
        "GIF89a", // GIF89a
        "RIFF", // WebP (starts with RIFF)
    ];
    
    $headerValid = false;
    foreach ($validHeaders as $header) {
        if (strpos($fileHeader, $header) === 0) {
            $headerValid = true;
            break;
        }
    }
    
    if (!$headerValid) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid file format detected']);
        return;
    }
    
    // Generate unique filename
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = uniqid() . '_' . time() . '.' . $extension;
    
    // Create upload directory if it doesn't exist
    $uploadDir = __DIR__ . '/../../uploads/products/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    $uploadPath = $uploadDir . $filename;
    
    // Move uploaded file
    if (move_uploaded_file($file['tmp_name'], $uploadPath)) {
        // AUTOMATIC IMAGE VERIFICATION: Verify image with AI before accepting
        $config = require __DIR__ . '/../config/ai_config.php';
        $verificationRequired = $config['image_verification']['required'] ?? true;
        $autoVerify = $config['image_verification']['auto_verify_on_upload'] ?? true;
        $minConfidence = $config['image_verification']['min_confidence'] ?? 0.6;
        
        $verificationResult = null;
        if ($verificationRequired && $autoVerify) {
            try {
                $analyzer = new ImageAnalyzer();
                $analysis = $analyzer->analyzeImage($uploadPath);
                
                // Check if analysis failed (error response)
                if (isset($analysis['error']) || (isset($analysis['analysis_method']) && $analysis['analysis_method'] === 'error')) {
                    $errorMessage = $analysis['error'] ?? $analysis['rejection_reason'] ?? 'Image verification service is temporarily unavailable.';
                    $isQuotaError = strpos($errorMessage, 'quota') !== false || strpos($errorMessage, 'insufficient_quota') !== false;
                    $quotaErrorMode = $config['image_verification']['quota_error_mode'] ?? 'reject';
                    
                    // Handle quota errors based on configuration
                    if ($isQuotaError && $quotaErrorMode === 'bypass') {
                        // Bypass verification and allow upload with warning
                        $verificationResult = [
                            'verified' => false,
                            'status' => 'warning',
                            'is_poultry_related' => null, // Unknown
                            'confidence' => 0,
                            'analysis' => null,
                            'warning' => 'Verification could not be completed automatically. The image was uploaded but still needs manual review.',
                            'error' => $errorMessage
                        ];
                        // Continue to upload the image
                    } elseif ($isQuotaError && $quotaErrorMode === 'warn') {
                        // Warn but allow upload
                        $verificationResult = [
                            'verified' => false,
                            'status' => 'warning',
                            'is_poultry_related' => null,
                            'confidence' => 0,
                            'analysis' => null,
                            'warning' => 'Verification could not be completed automatically. Please try again later or continue for manual review.',
                            'error' => $errorMessage
                        ];
                        // Continue to upload the image
                    } else {
                        // Default: reject upload
                        @unlink($uploadPath);
                        http_response_code(500);
                        echo json_encode([
                            'success' => false,
                            'error' => $errorMessage,
                            'rejection_reason' => $errorMessage,
                            'quota_error' => $isQuotaError,
                            'verification' => [
                                'verified' => false,
                                'status' => 'error',
                                'is_poultry_related' => false,
                                'confidence' => 0,
                                'analysis' => $analysis
                            ]
                        ]);
                        return;
                    }
                }
                
                // Skip verification checks if we're in bypass mode due to quota error
                if (isset($verificationResult) && isset($verificationResult['warning'])) {
                    // Already handled quota error in bypass/warn mode, continue to upload
                } else {
                    $isPoultryRelated = $analysis['is_poultry_related'] ?? false;
                    $confidence = $analysis['confidence'] ?? 0;
                    $verificationStatus = classifyVerificationResult($analysis, $config);

                    if ($verificationStatus === 'rejected') {
                        @unlink($uploadPath);
                        http_response_code(400);
                        echo json_encode([
                            'success' => false,
                            'error' => getVerificationUiMessage('rejected', $analysis, $minConfidence),
                            'rejection_reason' => getVerificationUiMessage('rejected', $analysis, $minConfidence),
                            'verification' => [
                                'verified' => false,
                                'status' => 'rejected',
                                'is_poultry_related' => $isPoultryRelated,
                                'confidence' => $confidence,
                                'analysis' => $analysis
                            ]
                        ]);
                        return;
                    }

                    $verificationResult = [
                        'verified' => true,
                        'status' => $verificationStatus,
                        'is_poultry_related' => $isPoultryRelated,
                        'confidence' => $confidence,
                        'analysis' => $analysis
                    ];

                    if ($verificationStatus === 'caution') {
                        $verificationResult['warning'] = getVerificationUiMessage('caution', $analysis, $minConfidence);
                    }
                }
                // If verificationResult is already set (from quota error handling), use it as-is
                
            } catch (Exception $e) {
                error_log("Image verification error: " . $e->getMessage());
                // If verification fails due to API error, we can either:
                // Option 1: Reject the image (strict mode)
                // Option 2: Accept but flag for manual review (lenient mode)
                // Using strict mode for security
                @unlink($uploadPath);
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Image verification service is temporarily unavailable. Please try again later.',
                    'rejection_reason' => 'Image verification service is temporarily unavailable. Please try again later.',
                    'verification' => null
                ]);
                return;
            }
        }
        
        // Return the URL path (dynamic based on the request host)
        // SECURITY: Sanitize host header to prevent header injection
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
        $host = filter_var($_SERVER['HTTP_HOST'], FILTER_SANITIZE_URL);
        // SECURITY: Validate host format and prevent path traversal in filename
        $safeFilename = basename($filename); // Ensure no path traversal
        $url = $protocol . '://' . $host . '/poultry-hub-kenya/uploads/products/' . $safeFilename;
        
        echo json_encode([
            'success' => true,
            'url' => $url,
            'filename' => $filename,
            'verification' => $verificationResult
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save file']);
    }
}

function handleMultipleImageUpload() {
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    
    if (!isset($_FILES['images'])) {
        http_response_code(400);
        echo json_encode(['error' => 'No image files provided']);
        return;
    }
    
    $files = $_FILES['images'];
    $uploadedFiles = [];
    $errors = [];
    $rejectionReasonForResponse = null;
    $rejectionVerification = null;
    
    // Create upload directory if it doesn't exist
    $uploadDir = __DIR__ . '/../../uploads/products/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    // Handle multiple files
    $fileCount = count($files['name']);
    for ($i = 0; $i < $fileCount; $i++) {
        if ($files['error'][$i] !== UPLOAD_ERR_OK) {
            $errors[] = "Upload error";
            continue;
        }
        
        // Check file size (max 5MB)
        if ($files['size'][$i] > 5 * 1024 * 1024) {
            $errors[] = "Image too large (max 5MB)";
            continue;
        }
        
        // Check file type with multiple validation methods
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        
        // Check MIME type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $files['tmp_name'][$i]);
        
        // Check file extension
        $extension = strtolower(pathinfo($files['name'][$i], PATHINFO_EXTENSION));
        
        // Validate both MIME type and extension
        if (!in_array($mimeType, $allowedTypes) || !in_array($extension, $allowedExtensions)) {
            $errors[] = "Invalid image type (only JPEG, PNG, GIF, WebP allowed)";
            continue;
        }
        
        // Additional security: Check file header (magic bytes)
        $fileHeader = file_get_contents($files['tmp_name'][$i], false, null, 0, 10);
        $validHeaders = [
            "\xFF\xD8\xFF", // JPEG
            "\x89PNG\r\n\x1a\n", // PNG
            "GIF87a", // GIF87a
            "GIF89a", // GIF89a
            "RIFF", // WebP (starts with RIFF)
        ];
        
        $headerValid = false;
        foreach ($validHeaders as $header) {
            if (strpos($fileHeader, $header) === 0) {
                $headerValid = true;
                break;
            }
        }
        
        if (!$headerValid) {
            $errors[] = "Invalid file format detected";
            continue;
        }
        
        // Generate unique filename (extension already validated above)
        $filename = uniqid() . '_' . time() . '_' . $i . '.' . $extension;
        $uploadPath = $uploadDir . $filename;
        
        // Move uploaded file
        if (move_uploaded_file($files['tmp_name'][$i], $uploadPath)) {
            // AUTOMATIC IMAGE VERIFICATION: Verify image with AI before accepting
            $config = require __DIR__ . '/../config/ai_config.php';
            $verificationRequired = $config['image_verification']['required'] ?? true;
            $autoVerify = $config['image_verification']['auto_verify_on_upload'] ?? true;
            $minConfidence = $config['image_verification']['min_confidence'] ?? 0.6;
            
            $verificationResult = null;
            $verificationPassed = true;
            
            if ($verificationRequired && $autoVerify) {
                try {
                    $analyzer = new ImageAnalyzer();
                    $analysis = $analyzer->analyzeImage($uploadPath);
                    
                    // Check if analysis failed (error response)
                    if (isset($analysis['error']) || (isset($analysis['analysis_method']) && $analysis['analysis_method'] === 'error')) {
                        $errorMessage = $analysis['error'] ?? $analysis['rejection_reason'] ?? 'Image verification service is temporarily unavailable.';
                        @unlink($uploadPath);
                        $errors[] = $errorMessage;
                        $verificationPassed = false;
                        continue;
                    }
                    
                    $isPoultryRelated = $analysis['is_poultry_related'] ?? false;
                    $confidence = $analysis['confidence'] ?? 0;
                    $verificationStatus = classifyVerificationResult($analysis, $config);
                    
                    if ($verificationStatus === 'rejected') {
                        @unlink($uploadPath);
                        $rejectionReason = getVerificationUiMessage('rejected', $analysis, $minConfidence);
                        $errors[] = $rejectionReason;
                        if ($rejectionVerification === null) {
                            $rejectionReasonForResponse = $rejectionReason;
                            $rejectionVerification = [
                                'verified' => false,
                                'status' => 'rejected',
                                'is_poultry_related' => false,
                                'confidence' => $confidence,
                                'analysis' => $analysis
                            ];
                        }
                        $verificationPassed = false;
                        continue;
                    }
                    
                    $verificationResult = [
                        'verified' => true,
                        'status' => $verificationStatus,
                        'is_poultry_related' => $isPoultryRelated,
                        'confidence' => $confidence,
                        'analysis' => $analysis
                    ];

                    if ($verificationStatus === 'caution') {
                        $verificationResult['warning'] = getVerificationUiMessage('caution', $analysis, $minConfidence);
                    }
                    
                } catch (Exception $e) {
                    error_log("Image verification error for file {$i}: " . $e->getMessage());
                    // Strict mode: reject on API error
                    @unlink($uploadPath);
                    $errors[] = "Image verification service is temporarily unavailable. Please try again later.";
                    $verificationPassed = false;
                    continue;
                }
            }
            
            // Only add to uploaded files if verification passed
            if ($verificationPassed) {
                // Return the URL path (dynamic based on the request host)
                // SECURITY: Sanitize host header to prevent header injection
                $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
                $host = filter_var($_SERVER['HTTP_HOST'], FILTER_SANITIZE_URL);
                // SECURITY: Validate host format and prevent path traversal in filename
                $safeFilename = basename($filename); // Ensure no path traversal
                $url = $protocol . '://' . $host . '/poultry-hub-kenya/uploads/products/' . $safeFilename;
                $uploadedFiles[] = [
                    'url' => $url,
                    'filename' => $filename,
                    'verification' => $verificationResult
                ];
            }
        } else {
            $errors[] = "Failed to save image";
        }
    }
    
    echo json_encode([
        'success' => count($uploadedFiles) > 0,
        'uploaded' => $uploadedFiles,
        'errors' => $errors,
        'rejection_reason' => $rejectionReasonForResponse,
        'verification' => $rejectionVerification
    ]);
}
?>
