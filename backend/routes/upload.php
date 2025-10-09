<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';

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
        // Return the URL path (dynamic based on the request host)
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'];
        $url = $protocol . '://' . $host . '/poultry-hub-kenya/uploads/products/' . $filename;
        
        echo json_encode([
            'success' => true,
            'url' => $url,
            'filename' => $filename
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
    
    // Create upload directory if it doesn't exist
    $uploadDir = __DIR__ . '/../../uploads/products/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    // Handle multiple files
    $fileCount = count($files['name']);
    for ($i = 0; $i < $fileCount; $i++) {
        if ($files['error'][$i] !== UPLOAD_ERR_OK) {
            $errors[] = "File {$i}: Upload error";
            continue;
        }
        
        // Check file size (max 5MB)
        if ($files['size'][$i] > 5 * 1024 * 1024) {
            $errors[] = "File {$i}: Too large (max 5MB)";
            continue;
        }
        
        // Check file type
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $files['tmp_name'][$i]);
        finfo_close($finfo);
        
        if (!in_array($mimeType, $allowedTypes)) {
            $errors[] = "File {$i}: Invalid type (only JPEG, PNG, GIF, WebP allowed)";
            continue;
        }
        
        // Generate unique filename
        $extension = pathinfo($files['name'][$i], PATHINFO_EXTENSION);
        $filename = uniqid() . '_' . time() . '_' . $i . '.' . $extension;
        $uploadPath = $uploadDir . $filename;
        
        // Move uploaded file
        if (move_uploaded_file($files['tmp_name'][$i], $uploadPath)) {
            // Return the URL path (dynamic based on the request host)
            $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'];
            $url = $protocol . '://' . $host . '/poultry-hub-kenya/uploads/products/' . $filename;
            $uploadedFiles[] = [
                'url' => $url,
                'filename' => $filename
            ];
        } else {
            $errors[] = "File {$i}: Failed to save";
        }
    }
    
    echo json_encode([
        'success' => count($uploadedFiles) > 0,
        'uploaded' => $uploadedFiles,
        'errors' => $errors
    ]);
}
?>
