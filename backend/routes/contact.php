<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/email.php';
require_once __DIR__ . '/../utils/auth.php';

function handleContactForm() {
    global $pdo;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    $required_fields = ['name', 'email', 'subject', 'message'];
    foreach ($required_fields as $field) {
        if (!isset($input[$field]) || empty(trim($input[$field]))) {
            http_response_code(400);
            echo json_encode(['error' => "Missing required field: $field"]);
            return;
        }
    }
    
    // Validate email format
    if (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid email format']);
        return;
    }
    
    try {
        // Insert contact message into database
        $stmt = $pdo->prepare("
            INSERT INTO contact_messages (name, email, phone, subject, category, message, status) 
            VALUES (?, ?, ?, ?, ?, ?, 'new')
        ");
        
        $stmt->execute([
            $input['name'],
            $input['email'],
            $input['phone'] ?? null,
            $input['subject'],
            $input['category'] ?? 'General',
            $input['message']
        ]);
        
        $messageId = $pdo->lastInsertId();
        
        // Create notification for all admins
        require_once __DIR__ . '/../utils/notifications.php';
        notifyAllAdmins("New contact message from {$input['name']}: {$input['subject']}");
        
        // Send notification email to admin
        $emailSent = sendContactNotification([
            'name' => $input['name'],
            'email' => $input['email'],
            'phone' => $input['phone'] ?? null,
            'subject' => $input['subject'],
            'category' => $input['category'] ?? 'General',
            'message' => $input['message']
        ]);
        
        // Send confirmation email to user
        $userSubject = "Thank you for contacting PoultryConnect Kenya";
        $userMessage = "
        <html>
        <head>
            <title>Contact Form Confirmation</title>
        </head>
        <body>
            <h2>Thank you for contacting us!</h2>
            <p>Dear " . htmlspecialchars($input['name']) . ",</p>
            <p>We have received your message and will get back to you within 24 hours.</p>
            <p><strong>Your message:</strong></p>
            <p>" . nl2br(htmlspecialchars($input['message'])) . "</p>
            <hr>
            <p><em>PoultryConnect Kenya Team</em></p>
        </body>
        </html>";
        
        sendEmail($input['email'], $userSubject, $userMessage);
        
        echo json_encode([
            'success' => true,
            'message' => 'Message sent successfully! We will get back to you soon.',
            'message_id' => $messageId,
            'email_sent' => $emailSent
        ]);
        
    } catch (PDOException $e) {
        error_log('Contact form error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to send message. Please try again.']);
    }
}

function handleGetContactMessages() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    // Validate admin session
    require_once __DIR__ . '/admin.php';
    if (!validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired admin session']);
        return;
    }
    
    try {
        $stmt = $pdo->query("
            SELECT id, name, email, phone, subject, category, message, status, admin_reply, created_at, updated_at 
            FROM contact_messages 
            ORDER BY created_at DESC
        ");
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode($messages);
        
    } catch (PDOException $e) {
        error_log('Get contact messages error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch messages']);
    }
}

function handleReplyToContact() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    // Validate admin session
    require_once __DIR__ . '/admin.php';
    if (!validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired admin session']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['message_id']) || !isset($input['reply'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Message ID and reply are required']);
        return;
    }
    
    try {
        // Get the original message
        $stmt = $pdo->prepare("SELECT * FROM contact_messages WHERE id = ?");
        $stmt->execute([$input['message_id']]);
        $originalMessage = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$originalMessage) {
            http_response_code(404);
            echo json_encode(['error' => 'Message not found']);
            return;
        }
        
        // Update the message with admin reply
        $stmt = $pdo->prepare("
            UPDATE contact_messages 
            SET admin_reply = ?, status = 'replied', updated_at = NOW() 
            WHERE id = ?
        ");
        $stmt->execute([$input['reply'], $input['message_id']]);
        
        // Send reply email to the original sender
        $subject = "Re: " . $originalMessage['subject'];
        $message = "
        <html>
        <head>
            <title>Reply from PoultryConnect Kenya</title>
        </head>
        <body>
            <h2>Reply from PoultryConnect Kenya</h2>
            <p>Dear " . htmlspecialchars($originalMessage['name']) . ",</p>
            <p>Thank you for contacting us. Here is our reply:</p>
            <div style='background-color: #f5f5f5; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;'>
                " . nl2br(htmlspecialchars($input['reply'])) . "
            </div>
            <p>If you have any further questions, please don't hesitate to contact us.</p>
            <hr>
            <p><em>PoultryConnect Kenya Team</em></p>
        </body>
        </html>";
        
        $emailSent = sendEmail($originalMessage['email'], $subject, $message);
        
        echo json_encode([
            'success' => true,
            'message' => 'Reply sent successfully',
            'email_sent' => $emailSent
        ]);
        
    } catch (PDOException $e) {
        error_log('Reply to contact error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to send reply']);
    }
}
?>
