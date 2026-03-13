<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../services/ai/ImageAnalyzer.php';

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
    finfo_close($finfo);
    
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
        $rejectNonPoultry = $config['image_verification']['reject_non_poultry'] ?? true;
        
        $verificationResult = null;
        if ($verificationRequired && $autoVerify) {
            try {
                $analyzer = new ImageAnalyzer();
                $analysis = $analyzer->analyzeImage($uploadPath);
                
                // Check if analysis failed (error response)
                if (isset($analysis['error']) || (isset($analysis['analysis_method']) && $analysis['analysis_method'] === 'error')) {
                    $errorMessage = $analysis['error'] ?? $analysis['rejection_reason'] ?? 'Failed to analyze image';
                    $isQuotaError = strpos($errorMessage, 'quota') !== false || strpos($errorMessage, 'insufficient_quota') !== false;
                    $quotaErrorMode = $config['image_verification']['quota_error_mode'] ?? 'reject';
                    
                    // Handle quota errors based on configuration
                    if ($isQuotaError && $quotaErrorMode === 'bypass') {
                        // Bypass verification and allow upload with warning
                        $verificationResult = [
                            'verified' => false,
                            'is_poultry_related' => null, // Unknown
                            'confidence' => 0,
                            'analysis' => null,
                            'warning' => 'AI verification skipped due to quota error. Image uploaded but not verified.',
                            'error' => $errorMessage
                        ];
                        // Continue to upload the image
                    } elseif ($isQuotaError && $quotaErrorMode === 'warn') {
                        // Warn but allow upload
                        $verificationResult = [
                            'verified' => false,
                            'is_poultry_related' => null,
                            'confidence' => 0,
                            'analysis' => null,
                            'warning' => 'AI verification failed due to quota error. Please verify image manually.',
                            'error' => $errorMessage
                        ];
                        // Continue to upload the image
                    } else {
                        // Default: reject upload
                        @unlink($uploadPath);
                        http_response_code(500);
                        echo json_encode([
                            'success' => false,
                            'error' => 'Image verification failed: ' . $errorMessage,
                            'rejection_reason' => $errorMessage,
                            'quota_error' => $isQuotaError,
                            'verification' => [
                                'verified' => false,
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
                    // Check if image is poultry-related and meets confidence threshold
                    $isPoultryRelated = $analysis['is_poultry_related'] ?? false;
                    $confidence = $analysis['confidence'] ?? 0;
                
                if ($rejectNonPoultry && !$isPoultryRelated) {
                    // Delete the uploaded file since it's not poultry-related
                    @unlink($uploadPath);
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Image verification failed: Image does not contain poultry-related content',
                        'rejection_reason' => $analysis['rejection_reason'] ?? 'Image must show poultry products (chickens, eggs, feed, equipment, etc.)',
                        'verification' => [
                            'verified' => false,
                            'is_poultry_related' => false,
                            'confidence' => $confidence,
                            'analysis' => $analysis
                        ]
                    ]);
                    return;
                }
                
                if ($confidence < $minConfidence) {
                    // Delete the uploaded file since confidence is too low
                    @unlink($uploadPath);
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Image verification failed: Low confidence score',
                        'rejection_reason' => "AI confidence ({$confidence}) is below minimum required ({$minConfidence})",
                        'verification' => [
                            'verified' => false,
                            'is_poultry_related' => $isPoultryRelated,
                            'confidence' => $confidence,
                            'analysis' => $analysis
                        ]
                    ]);
                    return;
                }
                
                // Image passed verification
                $verificationResult = [
                    'verified' => true,
                    'is_poultry_related' => $isPoultryRelated,
                    'confidence' => $confidence,
                    'analysis' => $analysis
                ];
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
                    'error' => 'Image verification failed: ' . $e->getMessage(),
                    'rejection_reason' => $e->getMessage(),
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
        finfo_close($finfo);
        
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
            $rejectNonPoultry = $config['image_verification']['reject_non_poultry'] ?? true;
            
            $verificationResult = null;
            $verificationPassed = true;
            
            if ($verificationRequired && $autoVerify) {
                try {
                    $analyzer = new ImageAnalyzer();
                    $analysis = $analyzer->analyzeImage($uploadPath);
                    
                    // Check if analysis failed (error response)
                    if (isset($analysis['error']) || (isset($analysis['analysis_method']) && $analysis['analysis_method'] === 'error')) {
                        $errorMessage = $analysis['error'] ?? $analysis['rejection_reason'] ?? 'Failed to analyze image';
                        @unlink($uploadPath);
                        $errors[] = "Image verification failed - " . $errorMessage . ". Please try again or check Gemini API configuration.";
                        $verificationPassed = false;
                        continue;
                    }
                    
                    // Check if image is poultry-related and meets confidence threshold
                    $isPoultryRelated = $analysis['is_poultry_related'] ?? false;
                    $confidence = $analysis['confidence'] ?? 0;
                    
                    if ($rejectNonPoultry && !$isPoultryRelated) {
                        // Delete the uploaded file since it's not poultry-related
                        @unlink($uploadPath);
                        $rejectionReason = $analysis['rejection_reason'] ?? 'Image must show poultry products (chickens, eggs, feed, equipment, etc.)';
                        $errors[] = "Image verification failed - Not poultry-related. " . $rejectionReason;
                        if ($rejectionVerification === null) {
                            $rejectionReasonForResponse = $rejectionReason;
                            $rejectionVerification = [
                                'verified' => false,
                                'is_poultry_related' => false,
                                'confidence' => $confidence,
                                'analysis' => $analysis
                            ];
                        }
                        $verificationPassed = false;
                        continue;
                    }
                    
                    if ($confidence < $minConfidence) {
                        // Delete the uploaded file since confidence is too low
                        @unlink($uploadPath);
                        $errors[] = "Image verification failed - Low confidence ({$confidence}). Minimum required: {$minConfidence}";
                        $verificationPassed = false;
                        continue;
                    }
                    
                    // Image passed verification
                    $verificationResult = [
                        'verified' => true,
                        'is_poultry_related' => $isPoultryRelated,
                        'confidence' => $confidence,
                        'analysis' => $analysis
                    ];
                    
                } catch (Exception $e) {
                    error_log("Image verification error for file {$i}: " . $e->getMessage());
                    // Strict mode: reject on API error
                    @unlink($uploadPath);
                    $errors[] = "Image verification failed - " . $e->getMessage() . ". Please try again or check Gemini API configuration.";
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
