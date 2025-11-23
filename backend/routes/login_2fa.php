<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/email.php';
require_once __DIR__ . '/../config/email_templates.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/security.php';

/**
 * Send login OTP to user's email
 * Called after user validates credentials (email + password)
 * Step 1 of 2FA login process
 */
function handleSendLoginOTP() {
    global $pdo;
    
    // Suppress error reporting for security
    error_reporting(E_ERROR | E_PARSE);
    ini_set('display_errors', 0);
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['email']) || !isset($input['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Email and password are required']);
        return;
    }
    
    $email = sanitizeInput($input['email']);
    $password = $input['password']; // Don't sanitize password as it might contain special chars
    
    // Rate limiting for OTP requests
    $clientIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (!checkRateLimit('send_otp_' . $clientIP, 5, 300)) { // 5 attempts per 5 minutes
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
    
    // Validate email domain exists (check DNS MX records) before attempting login
    // This helps prevent unnecessary database queries for invalid emails
    if (!validateEmailDomain($email)) {
        http_response_code(400);
        echo json_encode(['error' => 'The email address you provided does not exist. Please check your email address and try again.']);
        return;
    }
    
    try {
        // Fetch user by email
        $stmt = $pdo->prepare("SELECT id, email, password, full_name, role, account_status FROM user_profiles WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            // For security, don't reveal that email doesn't exist
            http_response_code(401);
            echo json_encode(['error' => 'Invalid credentials']);
            return;
        }
        
        // Verify password
        $passwordValid = password_verify($password, $user['password']);
        
        if (!$passwordValid) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid credentials']);
            return;
        }
        
        // Check if account is disabled
        if ($user['account_status'] === 'disabled') {
            http_response_code(403);
            echo json_encode(['error' => 'Your account has been disabled. Please contact support for assistance.']);
            return;
        }
        
        // SECURITY CHECK: Prevent admins from logging in through regular user login
        if ($user['role'] === 'admin') {
            http_response_code(401);
            echo json_encode(['error' => 'Admin accounts must use the admin login page. Please go to /admin-login']);
            return;
        }
        
        // Generate 6-digit OTP
        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        
        // Delete any existing non-expired OTPs for this user
        $stmt = $pdo->prepare("DELETE FROM login_otps WHERE user_email = ? AND expires_at > NOW()");
        $stmt->execute([$user['email']]);
        
        // Send OTP via email FIRST - only store if email is successfully sent
        $data = [
            'otp' => $otp,
            'user_name' => $user['full_name']
        ];
        
        $emailHtml = getEmailTemplate('login_otp', $data);
        $subject = 'Your Poultry Hub Kenya Login Verification Code';
        
        $emailSent = sendEmail($user['email'], $subject, $emailHtml);
        
        // Only store OTP in database if email was successfully sent
        if (!$emailSent) {
            error_log('Failed to send OTP email to: ' . $user['email']);
            http_response_code(503);
            echo json_encode(['error' => 'Unable to send OTP to your email address. The email service is temporarily unavailable. Please try again later or contact support if this issue persists.']);
            return;
        }
        
        // Email sent successfully - now store OTP in database with 10-minute expiry
        $expiresAt = date('Y-m-d H:i:s', time() + 600); // 10 minutes
        $stmt = $pdo->prepare("INSERT INTO login_otps (user_email, otp, expires_at) VALUES (?, ?, ?)");
        $stmt->execute([$user['email'], $otp, $expiresAt]);
        
        // Return success with user info (but NOT the OTP)
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'OTP sent to your email',
            'email' => $user['email'],
            'user_email' => $user['email']
        ]);
        
    } catch (PDOException $e) {
        error_log('Database error in handleSendLoginOTP: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'An error occurred. Please try again.']);
    } catch (Exception $e) {
        error_log('General error in handleSendLoginOTP: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'An error occurred. Please try again.']);
    }
}

/**
 * Verify login OTP and issue session token
 * Called after user enters OTP
 * Step 2 of 2FA login process
 */
function handleVerifyLoginOTP() {
    global $pdo;
    
    // Suppress error reporting for security
    error_reporting(E_ERROR | E_PARSE);
    ini_set('display_errors', 0);
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['user_email']) && !isset($input['user_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'User email and OTP are required']);
        return;
    }
    
    if (!isset($input['otp'])) {
        http_response_code(400);
        echo json_encode(['error' => 'OTP is required']);
        return;
    }
    
    // Support both user_email and user_id for backward compatibility
    $userEmail = sanitizeInput($input['user_email'] ?? $input['user_id']);
    $otp = sanitizeInput($input['otp']);
    
    // Validate OTP format (6 digits)
    if (!preg_match('/^\d{6}$/', $otp)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid OTP format']);
        return;
    }
    
    // Rate limiting for OTP verification
    $clientIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (!checkRateLimit('verify_otp_' . $clientIP, 10, 300)) { // 10 attempts per 5 minutes
        http_response_code(429);
        echo json_encode(['error' => 'Too many verification attempts. Please try again later.']);
        return;
    }
    
    try {
        // Fetch OTP from database and alias profile fields to avoid name collisions
        $stmt = $pdo->prepare("
            SELECT lo.*, up.id AS profile_id, up.email AS profile_email, up.full_name AS profile_full_name, up.role AS profile_role, up.account_status AS profile_account_status
            FROM login_otps lo
            JOIN user_profiles up ON lo.user_email = up.email
            WHERE lo.user_email = ? AND lo.otp = ? AND lo.used = FALSE AND lo.expires_at > NOW()
        ");
        $stmt->execute([$userEmail, $otp]);
        $otpRecord = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$otpRecord) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid or expired OTP']);
            return;
        }

        // Check if account is disabled
        if ($otpRecord['profile_account_status'] === 'disabled') {
            http_response_code(403);
            echo json_encode(['error' => 'Your account has been disabled. Please contact support for assistance.']);
            return;
        }

        // Mark OTP as used
        $stmt = $pdo->prepare("UPDATE login_otps SET used = TRUE, used_at = NOW() WHERE id = ?");
        $stmt->execute([$otpRecord['id']]);

        // Map aliased profile fields to local variables
        $profileId = $otpRecord['profile_id'];
        $profileEmail = $otpRecord['profile_email'];
        $profileName = $otpRecord['profile_full_name'];
        $profileRole = $otpRecord['profile_role'];

        // Generate JWT token
        $token = generateJWT($profileId, $profileEmail, $profileRole);

        // Get vendor approval status if user is a vendor
        $isApproved = true; // Default for non-vendors
        $vendorData = null;
        if ($profileRole === 'vendor') {
            $stmt = $pdo->prepare("SELECT status, farm_name, farm_description, location, id_number FROM vendors WHERE user_id = ?");
            $stmt->execute([$profileId]);
            $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
            $isApproved = $vendor && $vendor['status'] === 'approved';
            $vendorData = $vendor;
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'token' => $token,
            'user' => [
                'id' => $profileId,
                'email' => $profileEmail,
                'name' => $profileName,
                'role' => $profileRole,
                'isApproved' => $isApproved,
                'vendorData' => $vendorData
            ]
        ]);
        
    } catch (PDOException $e) {
        error_log('Database error in handleVerifyLoginOTP: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'An error occurred. Please try again.']);
    } catch (Exception $e) {
        error_log('General error in handleVerifyLoginOTP: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'An error occurred. Please try again.']);
    }
}

?>
