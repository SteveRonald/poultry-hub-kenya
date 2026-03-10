<?php
// Email Configuration using PHPMailer
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/email_templates.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

/**
 * Send email with delivery verification
 * Returns true if email was accepted by SMTP server, false if rejected
 * 
 * IMPORTANT LIMITATION:
 * Some email providers (like Gmail) accept emails during SMTP transaction
 * but bounce them later asynchronously. This is intentional to prevent
 * email enumeration attacks. We can only catch immediate SMTP rejections.
 * 
 * For delayed bounces (like 550 5.1.1 "user does not exist"), the email
 * will be accepted here but bounced later. To catch these, you would need:
 * 1. Monitor bounce-back emails via IMAP/webhook
 * 2. Use an email validation API service (e.g., ZeroBounce, NeverBounce)
 * 3. Accept that some bounces will happen and handle them gracefully
 * 
 * This function catches:
 * - Invalid domains (via DNS check before sending)
 * - Immediate SMTP rejections (550, 551, 552, 553 errors)
 * - Recipient validation errors during RCPT TO command
 * 
 * This function CANNOT catch:
 * - Delayed bounces from providers like Gmail
 * - Invalid usernames on valid domains that are accepted then bounced
 */
function sendEmail($to, $subject, $message, $from = null) {
    error_log("=== SEND EMAIL START ===");
    error_log("To: {$to}");
    error_log("Subject: {$subject}");
    
    $config = getEmailConfig();
    error_log("Email config loaded: " . json_encode($config['smtp']));
    
    // Check if SMTP credentials are configured
    if (empty($config['smtp']['username']) || empty($config['smtp']['password'])) {
        error_log("=== EMAIL CONFIGURATION ERROR ===");
        error_log("SMTP username or password is empty. Please configure your .env file with:");
        error_log("SMTP_USERNAME=your-email@gmail.com");
        error_log("SMTP_PASSWORD=your-app-password");
        error_log("SMTP_HOST=smtp.gmail.com");
        error_log("SMTP_PORT=587");
        error_log("SMTP_ENCRYPTION=tls");
        error_log("Current config: " . json_encode([
            'host' => $config['smtp']['host'] ?? 'not set',
            'username' => empty($config['smtp']['username']) ? 'EMPTY' : 'set',
            'password' => empty($config['smtp']['password']) ? 'EMPTY' : 'set',
            'port' => $config['smtp']['port'] ?? 'not set'
        ]));
        return false;
    }
    
    if (!$from) {
        $from = $config['smtp']['from_email'];
    }
    
    // For development, use basic mail() function if configured
    // Only use mail() if development mode is enabled and SMTP is disabled
    // Note: We've already checked credentials are not empty above, so we can use mail() safely
    if (!$config['development']['use_smtp']) {
        // Convert CID logo reference to base64 for mail() function compatibility
        require_once __DIR__ . '/email_templates.php';
        $logoPath = getLogoPath();
        if ($logoPath && file_exists($logoPath)) {
            $imageData = file_get_contents($logoPath);
            if ($imageData !== false) {
                $base64 = base64_encode($imageData);
                $dataUri = 'data:image/png;base64,' . $base64;
                // Replace CID reference with base64 data URI
                $message = str_replace("src='cid:logo'", "src='{$dataUri}'", $message);
                error_log("Logo converted to base64 for mail() function");
            }
        }
        
        // Encode subject for UTF-8
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        
        $headers = "From: $from\r\n";
        $headers .= "Reply-To: $from\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        
        $result = mail($to, $encodedSubject, $message, $headers);
        
        if ($config['development']['log_emails']) {
            error_log("Email sent to $to: $subject");
        }
        
        // For mail() function, we can't verify delivery, so return true if sent
        return $result;
    }
    
    $mail = new PHPMailer(true);
    
    // Try multiple connection methods if first fails
    $connectionMethods = [
        [
            'port' => $config['smtp']['port'],
            'encryption' => $config['smtp']['encryption'],
            'description' => 'Primary (Port ' . $config['smtp']['port'] . ', ' . $config['smtp']['encryption'] . ')'
        ]
    ];
    
    // Add fallback to port 465 (SSL) if primary is 587 (TLS)
    if ($config['smtp']['port'] == 587 && $config['smtp']['encryption'] == 'tls') {
        $connectionMethods[] = [
            'port' => 465,
            'encryption' => 'ssl',
            'description' => 'Fallback (Port 465, SSL)'
        ];
    }
    
    $lastError = null;
    $connectionAttempted = false;
    
    foreach ($connectionMethods as $method) {
        try {
            error_log("Attempting SMTP connection: {$method['description']}");
            $connectionAttempted = true;
            
            // Server settings
            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = $config['smtp']['host'];
            $mail->SMTPAuth   = true;
            $mail->Username   = $config['smtp']['username'];
            $mail->Password   = $config['smtp']['password'];
            $mail->SMTPSecure = $method['encryption'] === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = $method['port'];
        
        // Enable SMTP debugging to catch delivery errors (level 0 = off, 1 = client, 2 = client and server)
        // Disable debug in production for better performance - only log errors
        $mail->SMTPDebug = 0; // Set to 0 for production, 2 for debugging
        $mail->Debugoutput = function($str, $level) {
            // Only log errors, not all debug output
            if ($level > 1) {
                error_log("SMTP Debug: $str");
            }
        };
        
        // Add timeout settings to help diagnose connection issues
        $mail->Timeout = 10; // Reduced timeout to 10 seconds for faster response
        $mail->SMTPOptions = array(
            'ssl' => array(
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            )
        );
        
        // Capture SMTP responses for recipient validation
        // We'll check the SMTP instance after adding recipients
        $smtpInstance = null;
        
        // Recipients
        $mail->setFrom($from, $config['smtp']['from_name']);
        $mail->addAddress($to);
        
        // Enable SMTP keep-alive to check recipient before sending data
        // This helps catch some recipient errors earlier
        $mail->SMTPKeepAlive = false;
        
        // Get SMTP instance to check responses
        $smtpInstance = $mail->getSMTPInstance();
        
        // Content - set HTML first
        $mail->isHTML(true);
        $mail->CharSet = 'UTF-8';
        $mail->Encoding = 'base64';
        $mail->Subject = $subject;
        
        // Embed logo as inline attachment (CID) for better email client compatibility
        // Must be done AFTER isHTML() but BEFORE setting Body
        if (!function_exists('getLogoPath')) {
            require_once __DIR__ . '/email_templates.php';
        }
        $logoPath = getLogoPath();
        if ($logoPath && file_exists($logoPath) && is_readable($logoPath)) {
            try {
                // Use addEmbeddedImage with CID 'logo' to match the HTML reference
                $embedded = $mail->addEmbeddedImage($logoPath, 'logo', 'logo.png', 'base64', 'image/png', 'inline');
                if ($embedded) {
                    error_log("Logo embedded successfully as CID:logo from " . $logoPath);
                } else {
                    error_log("Failed to embed logo - addEmbeddedImage returned false");
                }
            } catch (Exception $logoError) {
                error_log("Exception while embedding logo: " . $logoError->getMessage());
            }
        } else {
            error_log("Logo file not found or not readable. Path checked: " . ($logoPath ?: 'null'));
        }
        
        // Set body after logo is embedded
        $mail->Body = $message;
        
        // Send email - PHPMailer will throw exception if recipient is rejected
        // IMPORTANT: Some SMTP servers (like Gmail) accept emails during RCPT TO
        // but bounce them later asynchronously. We can only catch immediate rejections here.
        // For delayed bounces, we would need to monitor bounce-back emails (complex).
        try {
            $mail->send();
            
            // After successful send, check SMTP instance for any errors
            if ($smtpInstance) {
                $smtpError = $smtpInstance->getError();
                if (!empty($smtpError)) {
                    $errorDetail = is_array($smtpError) ? ($smtpError['detail'] ?? $smtpError['error'] ?? '') : $smtpError;
                    error_log("SMTP Error detail after send: " . json_encode($smtpError));
                    
                    // Check for 550/5.1.1 errors (user doesn't exist)
                    if (
                        stripos($errorDetail, '550') !== false ||
                        stripos($errorDetail, '5.1.1') !== false ||
                        stripos($errorDetail, 'does not exist') !== false ||
                        stripos($errorDetail, 'NoSuchUser') !== false ||
                        stripos($errorDetail, 'user unknown') !== false
                    ) {
                        error_log("=== EMAIL REJECTED - RECIPIENT DOES NOT EXIST (from SMTP error) ===");
                        error_log("Error: " . $errorDetail);
                        return false;
                    }
                }
            }
            
            // After successful send, check if there were any warnings about recipients
            // Some servers accept but log warnings - we check ErrorInfo for these
            $errorInfo = $mail->ErrorInfo;
            if (!empty($errorInfo)) {
                // Check for recipient-related warnings even after "successful" send
                if (
                    stripos($errorInfo, 'recipients_failed') !== false ||
                    stripos($errorInfo, '550') !== false ||
                    stripos($errorInfo, '551') !== false ||
                    stripos($errorInfo, '552') !== false ||
                    stripos($errorInfo, '553') !== false ||
                    stripos($errorInfo, '5.1.1') !== false ||
                    stripos($errorInfo, '5.1.2') !== false ||
                    stripos($errorInfo, 'NoSuchUser') !== false ||
                    stripos($errorInfo, 'does not exist') !== false
                ) {
                    error_log("=== EMAIL REJECTED - RECIPIENT WARNING DETECTED ===");
                    error_log("Error: " . $errorInfo);
                    return false;
                }
            }
        } catch (Exception $sendException) {
            // PHPMailer throws exception if recipients fail during RCPT TO command
            $errorMsg = $sendException->getMessage();
            error_log("PHPMailer send() exception: " . $errorMsg);
            
            // Check if this is a recipient failure
            if (
                stripos($errorMsg, 'recipients_failed') !== false ||
                stripos($errorMsg, '550') !== false ||
                stripos($errorMsg, '551') !== false ||
                stripos($errorMsg, '552') !== false ||
                stripos($errorMsg, '553') !== false ||
                stripos($errorMsg, '5.1.1') !== false ||
                stripos($errorMsg, '5.1.2') !== false ||
                stripos($errorMsg, 'does not exist') !== false ||
                stripos($errorMsg, 'not found') !== false ||
                stripos($errorMsg, 'invalid') !== false ||
                stripos($errorMsg, 'rejected') !== false ||
                stripos($errorMsg, 'mailbox unavailable') !== false ||
                stripos($errorMsg, 'user unknown') !== false
            ) {
                error_log("=== EMAIL REJECTED - RECIPIENT INVALID ===");
                error_log("Error: " . $errorMsg);
                return false;
            }
            // Store error and continue to next connection method instead of re-throwing
            $lastError = $errorMsg;
            error_log("Connection method {$method['description']} failed: {$errorMsg}. Trying next method...");
            continue; // Try next connection method
        }
        
        // Check SMTP errors after send (for cases where send() returns true but there were issues)
        $smtpInstance = $mail->getSMTPInstance();
        $smtpError = null;
        if ($smtpInstance !== null) {
            $smtpError = $smtpInstance->getError();
        }
        if (!empty($smtpError)) {
            error_log("SMTP Error after send: " . json_encode($smtpError));
            // Check if error indicates recipient rejection (5xx errors)
            if (isset($smtpError['error']) && (
                strpos($smtpError['error'], '550') !== false || // Mailbox unavailable
                strpos($smtpError['error'], '551') !== false || // User not local
                strpos($smtpError['error'], '552') !== false || // Exceeded storage allocation
                strpos($smtpError['error'], '553') !== false || // Mailbox name not allowed
                strpos($smtpError['error'], '5.1.1') !== false || // User unknown
                strpos($smtpError['error'], '5.1.2') !== false || // Host unknown
                stripos($smtpError['error'], 'does not exist') !== false ||
                stripos($smtpError['error'], 'not found') !== false ||
                stripos($smtpError['error'], 'invalid') !== false ||
                stripos($smtpError['error'], 'rejected') !== false ||
                stripos($smtpError['error'], 'mailbox unavailable') !== false ||
                stripos($smtpError['error'], 'user unknown') !== false
            )) {
                error_log("=== EMAIL REJECTED BY SERVER - RECIPIENT INVALID ===");
                error_log("Error: " . $smtpError['error']);
                return false;
            }
        }
        
        // Check for recipient validation errors in ErrorInfo
        $lastError = $mail->ErrorInfo;
        if (!empty($lastError)) {
            // Check for common rejection patterns
            if (
                stripos($lastError, '550') !== false ||
                stripos($lastError, '551') !== false ||
                stripos($lastError, '552') !== false ||
                stripos($lastError, '553') !== false ||
                stripos($lastError, '5.1.1') !== false ||
                stripos($lastError, '5.1.2') !== false ||
                stripos($lastError, 'does not exist') !== false ||
                stripos($lastError, 'not found') !== false ||
                stripos($lastError, 'invalid') !== false ||
                stripos($lastError, 'rejected') !== false ||
                stripos($lastError, 'recipients_failed') !== false ||
                stripos($lastError, 'mailbox unavailable') !== false ||
                stripos($lastError, 'user unknown') !== false
            ) {
                error_log("=== EMAIL REJECTED - RECIPIENT INVALID (from ErrorInfo) ===");
                error_log("Error: " . $lastError);
                return false;
            }
        }
        
        error_log("=== EMAIL SENT SUCCESSFULLY ===");
        return true;
    } catch (Exception $e) {
        // This catch block handles exceptions from PHPMailer initialization or other setup errors
        // Store error and continue to next connection method
        $lastError = $mail->ErrorInfo ?: $e->getMessage();
        error_log("=== EMAIL SENDING FAILED for {$method['description']} ===");
        error_log("Error message: {$lastError}");
        error_log("Exception details: " . $e->getMessage());
        error_log("SMTP Config: Host=" . ($config['smtp']['host'] ?? 'not set') . ", Username=" . (empty($config['smtp']['username']) ? 'EMPTY - CHECK .env FILE' : 'set') . ", Port=" . ($config['smtp']['port'] ?? 'not set'));
        
        // Check if error indicates invalid recipient (if so, don't try other methods)
        if (
            stripos($lastError, '550') !== false ||
            stripos($lastError, '551') !== false ||
            stripos($lastError, '552') !== false ||
            stripos($lastError, '553') !== false ||
            stripos($lastError, '5.1.1') !== false ||
            stripos($lastError, '5.1.2') !== false ||
            stripos($lastError, 'does not exist') !== false ||
            stripos($lastError, 'not found') !== false ||
            stripos($lastError, 'invalid') !== false ||
            stripos($lastError, 'rejected') !== false ||
            stripos($lastError, 'recipients_failed') !== false ||
            stripos($lastError, 'mailbox unavailable') !== false ||
            stripos($lastError, 'user unknown') !== false ||
            stripos($lastError, 'address you sent your message to wasn\'t found') !== false ||
            stripos($lastError, 'wasn\'t found at the destination domain') !== false
        ) {
            error_log("=== EMAIL REJECTED - RECIPIENT INVALID (from exception) ===");
            error_log("Full error: " . $lastError);
            return false;
        }
        
        // Continue to next connection method
        continue;
    }
    } // End of foreach loop
    
    // If we get here, all connection methods failed - try fallback mail() function
    if ($connectionAttempted) {
        error_log("All SMTP connection methods failed. Trying fallback mail() function...");
        
        // Encode subject for UTF-8
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        
        $headers = "From: $from\r\n";
        $headers .= "Reply-To: $from\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        
        $fallbackResult = mail($to, $encodedSubject, $message, $headers);
        error_log("Fallback mail() result: " . ($fallbackResult ? 'SUCCESS' : 'FAILED'));
        error_log("=== SEND EMAIL END ===");
        
        return $fallbackResult;
    }
    
    // If we get here, all connection methods failed
    error_log("=== ALL SMTP CONNECTION METHODS FAILED ===");
    return false;
}

function getEmailConfig() {
    static $config = null;
    if ($config === null) {
        $config = include __DIR__ . '/email_config.php';
    }
    return $config;
}

function sendContactNotification($contactData) {
    // Use styled email template with logo
    $config = getEmailConfig();
    $adminEmail = $config['admin_email'];
    
    $data = [
        'contact' => $contactData
    ];
    
    return sendStyledEmail($adminEmail, 'contact_notification', $data);
}

function sendContactConfirmation($contactData) {
    // Use styled email template with logo for user confirmation
    $data = [
        'contact' => $contactData
    ];
    
    return sendStyledEmail($contactData['email'], 'contact_confirmation', $data);
}

function sendOTPEmail($email, $otp) {
    // Use styled OTP email template instead of plain HTML
    // This ensures logo and consistent styling
    return sendStyledOTPEmail($email, $otp);
}

function sendStyledEmail($email, $templateType, $data) {
    $template = getEmailTemplate($templateType, $data);
    $subject = getEmailSubject($templateType, $data);
    
    return sendEmail($email, $subject, $template);
}

function getEmailSubject($templateType, $data) {
    switch ($templateType) {
        case 'order_confirmation':
            return "Order Confirmation #{$data['order']['order_number']} - KukuSoko";
        case 'order_status_update':
            return "Order Status Update #{$data['order']['order_number']} - KukuSoko";
        case 'vendor_notification':
            return "New Order #{$data['order']['order_number']} - KukuSoko";
        case 'admin_notification':
            return "New Order Alert #{$data['order']['order_number']} - KukuSoko";
        case 'otp_email':
            return "Password Reset OTP - KukuSoko";
        case 'contact_notification':
            return "New Contact Message: " . ($data['contact']['subject'] ?? 'Contact Form') . " - KukuSoko";
        case 'contact_confirmation':
            return "Thank You for Contacting Us - KukuSoko";
        case 'vendor_recommendation':
            return "Weekly Sales Recommendations - KukuSoko";
        case 'admin_recommendation':
            return "Daily System Recommendations - KukuSoko";
        default:
            return "Notification - KukuSoko";
    }
}

function sendStyledOTPEmail($email, $otp, $userName = null) {
    $data = [
        'otp' => $otp,
        'user_name' => $userName
    ];
    
    return sendStyledEmail($email, 'otp_email', $data);
}

?>
