<?php
// Email Configuration using PHPMailer
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/email_config.php';
require_once __DIR__ . '/email_templates.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

function sendEmail($to, $subject, $message, $from = null) {
    $config = getEmailConfig();
    
    if (!$from) {
        $from = $config['smtp']['from_email'];
    }
    
    // For development, use basic mail() function if configured
    if (!$config['development']['use_smtp']) {
        $headers = "From: $from\r\n";
        $headers .= "Reply-To: $from\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        
        $result = mail($to, $subject, $message, $headers);
        
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
        
        // Content
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $message;
        
        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("Email sending failed: {$mail->ErrorInfo}");
        
        // Fallback to basic mail() function if SMTP fails
        $headers = "From: $from\r\n";
        $headers .= "Reply-To: $from\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        
        return mail($to, $subject, $message, $headers);
    }
}

function getEmailConfig() {
    return include __DIR__ . '/email_config.php';
}

function sendContactNotification($contactData) {
    $config = getEmailConfig();
    $adminEmail = $config['admin_email'];
    $subject = "New Contact Message: " . $contactData['subject'];
    
    $message = "
    <html>
    <head>
        <title>New Contact Message</title>
    </head>
    <body>
        <h2>New Contact Message Received</h2>
        <p><strong>Name:</strong> " . htmlspecialchars($contactData['name']) . "</p>
        <p><strong>Email:</strong> " . htmlspecialchars($contactData['email']) . "</p>
        <p><strong>Phone:</strong> " . htmlspecialchars($contactData['phone'] ?? 'Not provided') . "</p>
        <p><strong>Subject:</strong> " . htmlspecialchars($contactData['subject']) . "</p>
        <p><strong>Category:</strong> " . htmlspecialchars($contactData['category'] ?? 'General') . "</p>
        <p><strong>Message:</strong></p>
        <p>" . nl2br(htmlspecialchars($contactData['message'])) . "</p>
        <hr>
        <p><em>This message was sent from the PoultryConnect Kenya contact form.</em></p>
    </body>
    </html>";
    
    return sendEmail($adminEmail, $subject, $message);
}

function sendOTPEmail($email, $otp) {
    $subject = "Password Reset OTP - PoultryConnect Kenya";
    
    $message = "
    <html>
    <head>
        <title>Password Reset OTP</title>
    </head>
    <body>
        <h2>Password Reset Request</h2>
        <p>You have requested to reset your password for your PoultryConnect Kenya account.</p>
        <p><strong>Your OTP code is: <span style='font-size: 24px; color: #2563eb; font-weight: bold;'>$otp</span></strong></p>
        <p>This code will expire in 5 minutes.</p>
        <p>If you did not request this password reset, please ignore this email.</p>
        <hr>
        <p><em>PoultryConnect Kenya Team</em></p>
    </body>
    </html>";
    
    return sendEmail($email, $subject, $message);
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
