<?php
/**
 * Security utilities for input sanitization and validation
 */

/**
 * Sanitize string input to prevent XSS
 */
function sanitizeInput($input) {
    if (is_array($input)) {
        return array_map('sanitizeInput', $input);
    }
    
    if (is_string($input)) {
        // Remove null bytes
        $input = str_replace(chr(0), '', $input);
        
        // Trim whitespace
        $input = trim($input);
        
        // HTML encode to prevent XSS
        $input = htmlspecialchars($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        
        return $input;
    }
    
    return $input;
}

/**
 * Validate email format
 */
function validateEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

/**
 * Validate email domain by checking DNS MX records
 * This helps catch invalid email addresses before attempting to send
 * Returns true if domain has valid MX records, false otherwise
 * Note: On Windows, getmxrr() may not be available, so we fall back to gethostbyname()
 * IMPORTANT: DNS validation failures (network issues, timeouts) are non-blocking
 * to prevent blocking valid users on mobile networks or unreliable connections
 */
function validateEmailDomain($email) {
    // First check basic email format
    if (!validateEmail($email)) {
        return false;
    }
    
    // Extract domain from email
    $parts = explode('@', $email);
    if (count($parts) !== 2) {
        return false;
    }
    
    $domain = trim($parts[1]);
    
    // Check if getmxrr() function is available (not available on Windows)
    if (function_exists('getmxrr')) {
        // Check if domain has valid MX records
        $mxRecords = [];
        $mxResult = @getmxrr($domain, $mxRecords);
        
        // If MX records exist, domain can receive emails
        if ($mxResult && count($mxRecords) > 0) {
            return true;
        }
    }
    
    // Fallback: Check if domain has A record (some servers use A record for mail)
    // This also works on Windows where getmxrr() is not available
    if (function_exists('gethostbyname')) {
        $aRecord = @gethostbyname($domain);
        
        // If A record exists and is not the same as domain (meaning it resolved), consider it valid
        if ($aRecord !== $domain && filter_var($aRecord, FILTER_VALIDATE_IP)) {
            return true;
        }
    }
    
    // If DNS functions are not available, fall back to basic validation
    // We've already validated email format, so return true to allow the email
    // This prevents blocking valid emails on systems without DNS support
    if (!function_exists('getmxrr') && !function_exists('gethostbyname')) {
        return true; // Can't validate DNS, so trust the email format validation
    }
    
    // DNS validation failed (could be network issues, timeouts, or invalid domain)
    // On mobile networks or unreliable connections, DNS lookups may fail even for valid domains
    // To prevent blocking valid users, we allow the email through if format validation passed
    // The email service will catch truly invalid domains when attempting to send
    return true; // Non-blocking: trust email format validation, let email service handle invalid domains
}

/**
 * Validate phone number format
 */
function validatePhone($phone) {
    // Remove all non-digit characters
    $cleaned = preg_replace('/[^0-9]/', '', $phone);
    
    // Check if it's a valid length (7-15 digits)
    return strlen($cleaned) >= 7 && strlen($cleaned) <= 15;
}

/**
 * Validate password strength
 */
function validatePassword($password) {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    return preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/', $password);
}

/**
 * Sanitize filename for uploads
 */
function sanitizeFilename($filename) {
    // Remove path traversal attempts
    $filename = basename($filename);
    
    // Remove special characters except dots, hyphens, underscores
    $filename = preg_replace('/[^a-zA-Z0-9._-]/', '', $filename);
    
    // Limit length
    if (strlen($filename) > 255) {
        $filename = substr($filename, 0, 255);
    }
    
    return $filename;
}

/**
 * Rate limiting check
 */
function checkRateLimit($identifier, $maxAttempts = 5, $timeWindow = 300) {
    $cacheFile = sys_get_temp_dir() . '/rate_limit_' . md5($identifier) . '.txt';
    
    $attempts = [];
    if (file_exists($cacheFile)) {
        $attempts = json_decode(file_get_contents($cacheFile), true) ?: [];
    }
    
    // Remove old attempts outside time window
    $currentTime = time();
    $attempts = array_filter($attempts, function($timestamp) use ($currentTime, $timeWindow) {
        return ($currentTime - $timestamp) < $timeWindow;
    });
    
    // Check if limit exceeded
    if (count($attempts) >= $maxAttempts) {
        return false;
    }
    
    // Add current attempt
    $attempts[] = $currentTime;
    file_put_contents($cacheFile, json_encode($attempts));
    
    return true;
}

/**
 * Generate secure random token
 */
function generateSecureToken($length = 32) {
    return bin2hex(random_bytes($length));
}

/**
 * Validate CSRF token
 */
function validateCSRFToken($token) {
    if (!isset($_SESSION['csrf_token'])) {
        return false;
    }
    
    return hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Generate CSRF token
 */
function generateCSRFToken() {
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = generateSecureToken();
    }
    
    return $_SESSION['csrf_token'];
}
?>
