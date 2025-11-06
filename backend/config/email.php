<?php
// Email Configuration using PHPMailer
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/email_config.php';
require_once __DIR__ . '/email_templates.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

function sendEmail($to, $subject, $message, $from = null) {
    error_log("=== SEND EMAIL START ===");
    error_log("To: {$to}");
    error_log("Subject: {$subject}");
    
    $config = getEmailConfig();
    error_log("Email config loaded: " . json_encode($config['smtp']));
    
    if (!$from) {
        $from = $config['smtp']['from_email'];
    }
    
    // For development, use basic mail() function if configured
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
        
        return $result;
    }
    
    $mail = new PHPMailer(true);
    
    try {
        // Server settings
        $mail->isSMTP();
        $mail->Host       = $config['smtp']['host'];
        $mail->SMTPAuth   = true;
        $mail->Username   = $config['smtp']['username'];
        $mail->Password   = $config['smtp']['password'];
        $mail->SMTPSecure = $config['smtp']['encryption'] === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = $config['smtp']['port'];
        
        // Recipients
        $mail->setFrom($from, $config['smtp']['from_name']);
        $mail->addAddress($to);
        
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
        
        $mail->send();
        error_log("=== EMAIL SENT SUCCESSFULLY ===");
        return true;
    } catch (Exception $e) {
        error_log("Email sending failed: {$mail->ErrorInfo}");
        error_log("Exception details: " . $e->getMessage());
        
        // Fallback to basic mail() function if SMTP fails
        error_log("Trying fallback mail() function...");
        
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
}

function getEmailConfig() {
    return include __DIR__ . '/email_config.php';
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
            return "Order Confirmation #{$data['order']['order_number']} - Poultry Hub Kenya";
        case 'order_status_update':
            return "Order Status Update #{$data['order']['order_number']} - Poultry Hub Kenya";
        case 'vendor_notification':
            return "New Order #{$data['order']['order_number']} - Poultry Hub Kenya";
        case 'admin_notification':
            return "New Order Alert #{$data['order']['order_number']} - Poultry Hub Kenya";
        case 'otp_email':
            return "Password Reset OTP - Poultry Hub Kenya";
        case 'contact_notification':
            return "New Contact Message: " . ($data['contact']['subject'] ?? 'Contact Form') . " - Poultry Hub Kenya";
        case 'contact_confirmation':
            return "Thank You for Contacting Us - Poultry Hub Kenya";
        default:
            return "Notification - Poultry Hub Kenya";
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
