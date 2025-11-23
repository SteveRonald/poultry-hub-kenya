<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/email.php';
require_once __DIR__ . '/../config/email_templates.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/security.php';

/**
 * Send registration OTP to user's email
 * Called when user enters email during registration (step 1)
 * Auto-triggered on email blur or step advance
 */
function handleSendRegisterOTP() {
    global $pdo;
    
    // Suppress error reporting for security
    error_reporting(E_ERROR | E_PARSE);
    ini_set('display_errors', 0);
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['email'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Email is required']);
        return;
    }
    
    $email = sanitizeInput($input['email']);
    
    // Rate limiting for OTP requests
    $clientIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (!checkRateLimit('send_register_otp_' . $clientIP, 5, 300)) { // 5 attempts per 5 minutes
        http_response_code(429);
        echo json_encode(['error' => 'Too many OTP requests. Please try again later.']);
        return;
    }
    
    // Validate email format
    if (!validateEmail($email)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid email format']);
        return;
    }
    
    // Validate email domain exists (check DNS MX records)
    if (!validateEmailDomain($email)) {
        http_response_code(400);
        echo json_encode(['error' => 'The email address you provided does not exist. Please check your email address and try again.']);
        return;
    }
    
    try {
        // Check if email is already registered
        $stmt = $pdo->prepare("SELECT id FROM user_profiles WHERE email = ?");
        $stmt->execute([$email]);
        $existingUser = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($existingUser) {
            http_response_code(400);
            echo json_encode(['error' => 'This email is already registered. Please login or use a different email.']);
            return;
        }
        
        // Generate 6-digit OTP
        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        
        // Delete any existing non-expired OTPs for this email and purpose
        $stmt = $pdo->prepare("DELETE FROM email_otps WHERE email = ? AND purpose = 'registration' AND expires_at > NOW()");
        $stmt->execute([$email]);
        
        // Send OTP via email FIRST - only store if email is successfully sent
        $data = [
            'otp' => $otp,
            'email' => $email
        ];
        
        $emailHtml = getEmailTemplate('register_otp', $data);
        $subject = 'Your Poultry Hub Kenya Registration Verification Code';
        
        $emailSent = sendEmail($email, $subject, $emailHtml);
        
        // Only store OTP in database if email was successfully sent
        // Note: Some providers (like Gmail) accept emails but bounce them later.
        // We can only catch immediate rejections here.
        if (!$emailSent) {
            error_log('Failed to send registration OTP email to: ' . $email);
            http_response_code(503);
            echo json_encode([
                'error' => 'Unable to send verification code. The email service is temporarily unavailable. Please try again later or contact support if this issue persists.'
            ]);
            return;
        }
        
        // Email sent successfully - now store OTP in database with 10-minute expiry
        $expiresAt = date('Y-m-d H:i:s', time() + 600); // 10 minutes
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
        
        $stmt = $pdo->prepare("
            INSERT INTO email_otps (email, otp, purpose, expires_at, ip, user_agent)
            VALUES (?, ?, 'registration', ?, ?, ?)
        ");
        $stmt->execute([$email, $otp, $expiresAt, $clientIP, $userAgent]);
        
        // Return success
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Verification code sent to your email',
            'email' => $email
        ]);
        
    } catch (PDOException $e) {
        error_log('Database error in handleSendRegisterOTP: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'An error occurred. Please try again.']);
    } catch (Exception $e) {
        error_log('General error in handleSendRegisterOTP: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'An error occurred. Please try again.']);
    }
}

/**
 * Verify registration OTP for email
 * Called before final registration submit
 * Does NOT create user account - only validates OTP
 */
function handleVerifyRegisterOTP() {
    global $pdo;
    
    // Suppress error reporting for security
    error_reporting(E_ERROR | E_PARSE);
    ini_set('display_errors', 0);
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['email']) || !isset($input['otp'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Email and OTP are required']);
        return;
    }
    
    $email = sanitizeInput($input['email']);
    $otp = sanitizeInput($input['otp']);
    
    // Validate OTP format (6 digits)
    if (!preg_match('/^\d{6}$/', $otp)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid OTP format']);
        return;
    }
    
    // Rate limiting for OTP verification
    $clientIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (!checkRateLimit('verify_register_otp_' . $clientIP, 10, 300)) { // 10 attempts per 5 minutes
        http_response_code(429);
        echo json_encode(['error' => 'Too many verification attempts. Please try again later.']);
        return;
    }
    
    try {
        // Fetch OTP from database
        $stmt = $pdo->prepare("
            SELECT id, otp, used, expires_at, attempts
            FROM email_otps
            WHERE email = ? AND purpose = 'registration' AND otp = ? AND used = FALSE AND expires_at > NOW()
        ");
        $stmt->execute([$email, $otp]);
        $otpRecord = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$otpRecord) {
            // Increment attempts for failed OTP
            $stmt = $pdo->prepare("
                UPDATE email_otps
                SET attempts = attempts + 1
                WHERE email = ? AND purpose = 'registration' AND expires_at > NOW()
                LIMIT 1
            ");
            $stmt->execute([$email]);
            
            http_response_code(401);
            echo json_encode(['error' => 'Invalid or expired verification code']);
            return;
        }

        // Mark OTP as used
        $stmt = $pdo->prepare("UPDATE email_otps SET used = TRUE, used_at = NOW() WHERE id = ?");
        $stmt->execute([$otpRecord['id']]);

        // Return success - OTP is valid
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Email verified successfully',
            'email' => $email,
            'verified' => true
        ]);
        
    } catch (PDOException $e) {
        error_log('Database error in handleVerifyRegisterOTP: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'An error occurred. Please try again.']);
    } catch (Exception $e) {
        error_log('General error in handleVerifyRegisterOTP: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'An error occurred. Please try again.']);
    }
}

/**
 * Resend registration OTP to email
 * Called when user clicks resend button
 */
function handleResendRegisterOTP() {
    global $pdo;
    
    // Suppress error reporting for security
    error_reporting(E_ERROR | E_PARSE);
    ini_set('display_errors', 0);
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['email'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Email is required']);
        return;
    }
    
    $email = sanitizeInput($input['email']);
    
    // Rate limiting for resend requests
    $clientIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (!checkRateLimit('resend_register_otp_' . $clientIP, 3, 300)) { // 3 attempts per 5 minutes
        http_response_code(429);
        echo json_encode(['error' => 'Too many resend requests. Please try again later.']);
        return;
    }
    
    try {
        // Check if email exists in registration
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM email_otps WHERE email = ? AND purpose = 'registration' AND expires_at > NOW()");
        $stmt->execute([$email]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result['count'] == 0) {
            http_response_code(400);
            echo json_encode(['error' => 'No pending verification for this email. Please start registration again.']);
            return;
        }
        
        // Delete old OTP and generate new one
        $stmt = $pdo->prepare("DELETE FROM email_otps WHERE email = ? AND purpose = 'registration'");
        $stmt->execute([$email]);
        
        // Generate new 6-digit OTP
        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        
        // Send OTP via email FIRST - only store if email is successfully sent
        $data = [
            'otp' => $otp,
            'email' => $email
        ];
        
        $emailHtml = getEmailTemplate('register_otp', $data);
        $subject = 'Your Poultry Hub Kenya Registration Verification Code';
        
        $emailSent = sendEmail($email, $subject, $emailHtml);
        
        // Only store OTP in database if email was successfully sent
        if (!$emailSent) {
            error_log('Failed to resend registration OTP email to: ' . $email);
            http_response_code(503);
            echo json_encode(['error' => 'Unable to send verification code. The email service is temporarily unavailable. Please try again later or contact support if this issue persists.']);
            return;
        }
        
        // Email sent successfully - now store new OTP with 10-minute expiry
        $expiresAt = date('Y-m-d H:i:s', time() + 600);
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
        
        $stmt = $pdo->prepare("
            INSERT INTO email_otps (email, otp, purpose, expires_at, ip, user_agent)
            VALUES (?, ?, 'registration', ?, ?, ?)
        ");
        $stmt->execute([$email, $otp, $expiresAt, $clientIP, $userAgent]);
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Verification code resent to your email',
            'email' => $email
        ]);
        
    } catch (PDOException $e) {
        error_log('Database error in handleResendRegisterOTP: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'An error occurred. Please try again.']);
    } catch (Exception $e) {
        error_log('General error in handleResendRegisterOTP: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'An error occurred. Please try again.']);
    }
}

?>
