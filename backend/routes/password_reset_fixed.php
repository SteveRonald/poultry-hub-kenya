<?php
// Disable error display to prevent JSON corruption
ini_set('display_errors', 0);
error_reporting(E_ALL);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/email.php';

function handleForgotPassword() {
    global $pdo;
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['email']) || empty(trim($input['email']))) {
            http_response_code(400);
            echo json_encode(['error' => 'Email is required']);
            return;
        }
        
        $email = trim($input['email']);
        
        // Validate email format
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid email format']);
            return;
        }
        
        // Check if user exists
        $stmt = $pdo->prepare("SELECT id, full_name, email FROM user_profiles WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            // For security, don't reveal if email exists or not
            echo json_encode([
                'success' => true,
                'message' => 'If the email exists, a password reset code has been sent.'
            ]);
            return;
        }
        
        // Generate 6-digit OTP
        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        
        // Set expiration time (5 minutes from now)
        $expiresAt = date('Y-m-d H:i:s', strtotime('+5 minutes'));
        
        // Delete any existing OTP for this email
        $stmt = $pdo->prepare("DELETE FROM otp_verification WHERE email = ?");
        $stmt->execute([$email]);
        
        // Insert new OTP
        $stmt = $pdo->prepare("
            INSERT INTO otp_verification (email, otp, expires_at) 
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$email, $otp, $expiresAt]);
        
        // Send OTP email
        $emailSent = sendOTPEmail($email, $otp);
        
        if ($emailSent) {
            echo json_encode([
                'success' => true,
                'message' => 'Password reset code has been sent to your email.'
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'error' => 'Failed to send email. Please try again.'
            ]);
        }
        
    } catch (PDOException $e) {
        error_log('Forgot password error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to process request. Please try again.']);
    } catch (Exception $e) {
        error_log('Forgot password error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to process request. Please try again.']);
    }
}

function handleVerifyOTP() {
    global $pdo;
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['email']) || !isset($input['otp'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Email and OTP are required']);
            return;
        }
        
        $email = trim($input['email']);
        $otp = trim($input['otp']);
        
        // Check if OTP exists and is valid
        $stmt = $pdo->prepare("
            SELECT id, email, otp, expires_at, used 
            FROM otp_verification 
            WHERE email = ? AND otp = ? AND used = 0
        ");
        $stmt->execute([$email, $otp]);
        $otpRecord = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$otpRecord) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid or expired OTP']);
            return;
        }
        
        // Check if OTP has expired
        if (strtotime($otpRecord['expires_at']) < time()) {
            http_response_code(400);
            echo json_encode(['error' => 'OTP has expired. Please request a new one.']);
            return;
        }
        
        // Mark OTP as used
        $stmt = $pdo->prepare("UPDATE otp_verification SET used = 1 WHERE id = ?");
        $stmt->execute([$otpRecord['id']]);
        
        // Generate a temporary token for password reset (valid for 10 minutes)
        $resetToken = bin2hex(random_bytes(32));
        $tokenExpires = date('Y-m-d H:i:s', strtotime('+10 minutes'));
        
        // Store reset token in database
        $stmt = $pdo->prepare("
            INSERT INTO otp_verification (email, otp, expires_at, used) 
            VALUES (?, ?, ?, 0)
        ");
        $stmt->execute([$email, $resetToken, $tokenExpires]);
        
        echo json_encode([
            'success' => true,
            'message' => 'OTP verified successfully',
            'reset_token' => $resetToken
        ]);
        
    } catch (PDOException $e) {
        error_log('Verify OTP error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to verify OTP. Please try again.']);
    } catch (Exception $e) {
        error_log('Verify OTP error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to verify OTP. Please try again.']);
    }
}

function handleResetPassword() {
    global $pdo;
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $required_fields = ['email', 'reset_token', 'new_password'];
        foreach ($required_fields as $field) {
            if (!isset($input[$field]) || empty(trim($input[$field]))) {
                http_response_code(400);
                echo json_encode(['error' => "Missing required field: $field"]);
                return;
            }
        }
        
        $email = trim($input['email']);
        $resetToken = trim($input['reset_token']);
        $newPassword = trim($input['new_password']);
        
        // Validate password strength
        if (strlen($newPassword) < 6) {
            http_response_code(400);
            echo json_encode(['error' => 'Password must be at least 6 characters long']);
            return;
        }
        
        // Verify reset token
        $stmt = $pdo->prepare("
            SELECT id, email, expires_at, used 
            FROM otp_verification 
            WHERE email = ? AND otp = ? AND used = 0
        ");
        $stmt->execute([$email, $resetToken]);
        $tokenRecord = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$tokenRecord) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid or expired reset token']);
            return;
        }
        
        // Check if token has expired
        if (strtotime($tokenRecord['expires_at']) < time()) {
            http_response_code(400);
            echo json_encode(['error' => 'Reset token has expired. Please request a new password reset.']);
            return;
        }
        
        // Hash new password
        $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
        
        // Update user password
        $stmt = $pdo->prepare("UPDATE user_profiles SET password = ? WHERE email = ?");
        $stmt->execute([$hashedPassword, $email]);
        
        // Mark reset token as used
        $stmt = $pdo->prepare("UPDATE otp_verification SET used = 1 WHERE id = ?");
        $stmt->execute([$tokenRecord['id']]);
        
        // Delete all OTP records for this email
        $stmt = $pdo->prepare("DELETE FROM otp_verification WHERE email = ?");
        $stmt->execute([$email]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Password has been reset successfully. You can now login with your new password.'
        ]);
        
    } catch (PDOException $e) {
        error_log('Reset password error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to reset password. Please try again.']);
    } catch (Exception $e) {
        error_log('Reset password error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to reset password. Please try again.']);
    }
}

function handleResendOTP() {
    global $pdo;
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['email']) || empty(trim($input['email']))) {
            http_response_code(400);
            echo json_encode(['error' => 'Email is required']);
            return;
        }
        
        $email = trim($input['email']);
        
        // Check if user exists
        $stmt = $pdo->prepare("SELECT id, full_name FROM user_profiles WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            return;
        }
        
        // Generate new 6-digit OTP
        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        
        // Set expiration time (5 minutes from now)
        $expiresAt = date('Y-m-d H:i:s', strtotime('+5 minutes'));
        
        // Delete any existing OTP for this email
        $stmt = $pdo->prepare("DELETE FROM otp_verification WHERE email = ?");
        $stmt->execute([$email]);
        
        // Insert new OTP
        $stmt = $pdo->prepare("
            INSERT INTO otp_verification (email, otp, expires_at) 
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$email, $otp, $expiresAt]);
        
        // Send OTP email
        $emailSent = sendOTPEmail($email, $otp);
        
        if ($emailSent) {
            echo json_encode([
                'success' => true,
                'message' => 'New password reset code has been sent to your email.'
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'error' => 'Failed to send email. Please try again.'
            ]);
        }
        
    } catch (PDOException $e) {
        error_log('Resend OTP error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to resend OTP. Please try again.']);
    } catch (Exception $e) {
        error_log('Resend OTP error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to resend OTP. Please try again.']);
    }
}
?>

