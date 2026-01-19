<?php
// Paystack Payment Gateway Routes

// Include auth utilities
require_once __DIR__ . '/../utils/auth.php';

// Initialize Paystack transaction
function handleInitializePaystackPayment() {
    global $pdo;
    
    try {
        error_log("Paystack initialization started");
        $input = json_decode(file_get_contents('php://input'), true);
        error_log("Input data: " . print_r($input, true));
        
        $order_id = $input['order_id'] ?? null;
        $amount = $input['amount'] ?? null;
        $email = $input['email'] ?? null;
        $callback_url = $input['callback_url'] ?? null;

        error_log("Parsed data - order_id: $order_id, amount: $amount, email: $email");

        if (!$amount || !$email) {
            error_log("Missing required fields");
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Missing required fields: amount, email'
            ]);
            return;
        }

        // Get user ID from JWT token
        $headers = getallheaders();
        $auth_header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        $token = str_replace('Bearer ', '', $auth_header);
        
        if (!$token) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Authorization required']);
            return;
        }

        $user_data = validateJWT($token);
        if (!$user_data) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Invalid token']);
            return;
        }

        $user_id = $user_data['user_id'];

        // If order_id is provided, verify it exists and belongs to user
        if ($order_id && $order_id !== 'pending' && $order_id !== 0) {
            $stmt = $pdo->prepare("SELECT id, user_id, total_amount, payment_status FROM orders WHERE id = ?");
            $stmt->execute([$order_id]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$order) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Order not found']);
                return;
            }

            if ($order['user_id'] != $user_id) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Order does not belong to user']);
                return;
            }

            if ($order['payment_status'] === 'paid') {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Order is already paid']);
                return;
            }
        }

        // Load Paystack config
        require_once __DIR__ . '/../config/paystack_config.php';
        $config_errors = validatePaystackConfig();
        
        if (!empty($config_errors)) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'Paystack configuration missing: ' . implode(', ', $config_errors)
            ]);
            return;
        }

        // Generate Paystack transaction reference
        $reference = generatePaystackReference($order_id);
        error_log("Generated reference: $reference for order_id: $order_id");

        // Store transaction record BEFORE calling Paystack
        $stmt = $pdo->prepare("
            INSERT INTO payment_transactions (
                transaction_reference, order_id, user_id, amount, currency,
                payment_method, payment_status, metadata, created_at
            ) VALUES (?, ?, ?, ?, 'KES', 'paystack', 'pending', ?, NOW())
        ");
        $stmt->execute([
            $reference,
            $order_id,
            $user_id,
            $amount,
            json_encode(['initialized_at' => date('Y-m-d H:i:s')])
        ]);

        // Prepare Paystack API request
        $paystack_data = [
            'email' => $email,
            'amount' => $amount * 100, // Convert to cents
            'reference' => $reference,
            'currency' => 'KES', // Explicitly set currency
            'callback_url' => $callback_url ?: (getenv('APP_URL') ?: 'http://localhost:8080') . '/checkout/success'
        ];

        $ch = curl_init(PAYSTACK_INIT_TRANSACTION);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($paystack_data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, getPaystackHeaders());
        curl_setopt($ch, CURLOPT_TIMEOUT, PAYSTACK_REQUEST_TIMEOUT);

        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $paystack_result = json_decode($response, true);
        error_log("Paystack response: " . print_r($paystack_result, true));

        if ($http_code !== 200 || !$paystack_result['status']) {
            error_log("Paystack failed with HTTP code: $http_code");
            // Update transaction status to failed
            $stmt = $pdo->prepare("
                UPDATE payment_transactions SET
                    payment_status = 'failed',
                    gateway_response = ?,
                    updated_at = NOW()
                WHERE transaction_reference = ?
            ");
            $stmt->execute([
                json_encode($paystack_result),
                $reference
            ]);

            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => $paystack_result['message'] ?? 'Payment initialization failed'
            ]);
            return;
        }

        error_log("Paystack success - reference: {$paystack_result['data']['reference']}, access_code: {$paystack_result['data']['access_code']}");
        error_log("Paystack success - Our generated reference: $reference, Paystack returned reference: {$paystack_result['data']['reference']}");

        // Update transaction with Paystack access code and use Paystack's reference
        $stmt = $pdo->prepare("
            UPDATE payment_transactions SET
                payment_status = 'initialized',
                paystack_access_code = ?,
                paystack_reference = ?, -- Store only Paystack's reference
                paystack_transaction_id = ?, -- Store Paystack transaction ID
                gateway_response = ?,
                updated_at = NOW()
            WHERE transaction_reference = ?
        ");
        $stmt->execute([
            $paystack_result['data']['access_code'],
            $paystack_result['data']['reference'], // Store only the reference string
            $paystack_result['data']['reference'], // Store as transaction ID too
            json_encode($paystack_result['data']),
            $reference
        ]);

        echo json_encode([
            'success' => true,
            'reference' => $paystack_result['data']['reference'], // Return Paystack's reference
            'access_code' => $paystack_result['data']['access_code'],
            'public_key' => PAYSTACK_PUBLIC_KEY,
            'order_id' => $order_id,
            'our_reference' => $reference // For debugging
        ]);

    } catch (Exception $e) {
        error_log("Paystack initialization error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to initialize payment'
        ]);
    }
}

// Verify Paystack transaction
function handleVerifyPaystackPayment($reference) {
    global $pdo;
    
    try {
        if (!$reference) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Reference is required']);
            return;
        }

        // First try to find by Paystack reference (the one Paystack actually returns)
        $stmt = $pdo->prepare("SELECT * FROM payment_transactions WHERE paystack_reference = ?");
        $stmt->execute([$reference]);
        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);

        // If not found by Paystack reference, try by our generated reference
        if (!$transaction) {
            $stmt = $pdo->prepare("SELECT * FROM payment_transactions WHERE transaction_reference = ?");
            $stmt->execute([$reference]);
            $transaction = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        if (!$transaction) {
            error_log("Transaction not found by reference: $reference");
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Transaction not found']);
            return;
        }

        // Load Paystack config
        require_once __DIR__ . '/../config/paystack_config.php';
        $config_errors = validatePaystackConfig();
        
        if (!empty($config_errors)) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Paystack configuration missing']);
            return;
        }

        // Verify transaction with Paystack
        $ch = curl_init(PAYSTACK_VERIFY_TRANSACTION . $reference);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPGET, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, getPaystackHeaders());
        curl_setopt($ch, CURLOPT_TIMEOUT, PAYSTACK_REQUEST_TIMEOUT);

        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $verification_result = json_decode($response, true);

        if ($http_code !== 200 || !$verification_result['status']) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => $verification_result['message'] ?? 'Payment verification failed'
            ]);
            return;
        }

        // Update transaction and order status based on verification
        $payment_status = $verification_result['data']['status'] === 'success' ? 'success' : 'failed';

        $stmt = $pdo->prepare("
            UPDATE payment_transactions SET
                payment_status = ?,
                paystack_transaction_id = ?,
                paystack_paid_at = ?,
                gateway_response = ?,
                updated_at = NOW()
            WHERE transaction_reference = ?
        ");
        $stmt->execute([
            $payment_status,
            $verification_result['data']['id'],
            $verification_result['data']['paid_at'] ?? null,
            $response,
            $reference
        ]);

        // Update order payment status only if payment was successful
        if ($payment_status === 'success') {
            $stmt = $pdo->prepare("
                UPDATE orders SET
                    payment_status = 'paid',
                    payment_transaction_id = ?,
                    payment_completed_at = NOW(),
                    payment_reference = ?,
                    updated_at = NOW()
                WHERE id = ?
            ");
            $stmt->execute([
                $verification_result['data']['id'],
                $reference,
                $transaction['order_id']
            ]);
        }

        echo json_encode([
            'success' => true,
            'message' => 'Payment verified successfully',
            'data' => $verification_result['data'],
            'order_id' => $transaction['order_id']
        ]);

    } catch (Exception $e) {
        error_log("Paystack verification error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to verify payment'
        ]);
    }
}

// Handle manual payment verification (for localhost testing)
function handleManualPaymentVerification() {
    global $pdo;
    
    // Disable error display, only log errors
    ini_set('display_errors', 0);
    error_reporting(E_ALL);
    
    // Set headers to ensure JSON response
    header('Content-Type: application/json');
    
    try {
        // Debug: Log the raw input
        $rawInput = file_get_contents('php://input');
        error_log("Raw input received: " . $rawInput);
        
        $input = json_decode($rawInput, true);
        
        // Debug: Check if JSON parsing failed
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("JSON parsing error: " . json_last_error_msg());
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid JSON data']);
            return;
        }
        
        $reference = $input['reference'] ?? null;
        $checkoutData = $input['checkout_data'] ?? null;
        $paymentDetails = $input['payment_details'] ?? null;
        
        error_log("Manual verification started for reference: $reference");
        error_log("Checkout data: " . print_r($checkoutData, true));
        error_log("Payment details: " . print_r($paymentDetails, true));
        
        if (!$reference) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Reference is required']);
            return;
        }
        
        // Get the payment transaction
        $stmt = $pdo->prepare("SELECT * FROM payment_transactions WHERE paystack_reference = ?");
        $stmt->execute([$reference]);
        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$transaction) {
            error_log("Payment transaction not found for reference: $reference");
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Payment transaction not found']);
            return;
        }
        
        if (!$checkoutData || !isset($checkoutData['items'])) {
            error_log("Checkout data missing for reference: $reference");
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Checkout data is required']);
            return;
        }
        
        error_log("Creating orders for " . count($checkoutData['items']) . " items");
        
        // Create order for each item in checkout
        $orderIds = [];
        foreach ($checkoutData['items'] as $item) {
            $orderNumber = 'ORD-' . date('YmdHis') . '-' . strtoupper(substr(uniqid(), 0, 4));
            
            // Get vendor ID from product
            $vendorId = null;
            if (isset($item['product_id'])) {
                $vendorStmt = $pdo->prepare("SELECT vendor_id FROM products WHERE id = ?");
                $vendorStmt->execute([$item['product_id']]);
                $vendorData = $vendorStmt->fetch(PDO::FETCH_ASSOC);
                $vendorId = $vendorData['vendor_id'] ?? null;
                error_log("Product ID: {$item['product_id']}, Vendor ID: $vendorId");
            } else {
                error_log("No product_id found in item: " . print_r($item, true));
            }
            
            // Extract payment account number from Paystack details
            $paymentAccountNumber = null;
            $paymentMethod = 'card'; // default
            
            if ($paymentDetails) {
                // Use selected_method first (user's selection), then fallback to channel
                $paymentMethod = $paymentDetails['selected_method'] ?? $paymentDetails['channel'] ?? 'card';
                error_log("Payment method detected: $paymentMethod (selected_method: " . ($paymentDetails['selected_method'] ?? 'null') . ", channel: " . ($paymentDetails['channel'] ?? 'null') . ")");
                error_log("Payment details: " . print_r($paymentDetails, true));
                
                // Extract account number based on payment method
                if ($paymentMethod === 'mobile_money' || $paymentMethod === 'mpesa') {
                    // Try multiple possible phone number locations
                    $phone = null;
                    if (isset($paymentDetails['customer']['phone'])) {
                        $phone = $paymentDetails['customer']['phone'];
                    } elseif (isset($paymentDetails['transaction']['phone'])) {
                        $phone = $paymentDetails['transaction']['phone'];
                    } elseif (isset($paymentDetails['transaction']['mobile_money_number'])) {
                        $phone = $paymentDetails['transaction']['mobile_money_number'];
                    }
                    $paymentAccountNumber = $phone;
                    error_log("Mobile money/M-Pesa phone: $phone");
                } elseif ($paymentMethod === 'card') {
                    // Handle card payment - transaction might be string or object
                    $cardLast4 = null;
                    if (is_string($paymentDetails['transaction'])) {
                        // If transaction is just a string (transaction ID), use generic mask
                        $cardLast4 = $paymentDetails['transaction'];
                        $paymentAccountNumber = 'Transaction ID: ' . $cardLast4;
                        error_log("Card transaction ID: $cardLast4");
                    } elseif (isset($paymentDetails['transaction']['card']['last4'])) {
                        $cardLast4 = $paymentDetails['transaction']['card']['last4'];
                        $paymentAccountNumber = '**** **** **** ' . $cardLast4;
                        error_log("Card last4: $paymentAccountNumber");
                    } else {
                        $paymentAccountNumber = 'Card Payment';
                        error_log("Card payment - no details available");
                    }
                } elseif ($paymentMethod === 'bank' && isset($paymentDetails['transaction']['account_number'])) {
                    $paymentAccountNumber = $paymentDetails['transaction']['account_number'];
                    error_log("Bank account: $paymentAccountNumber");
                } else {
                    error_log("No payment account number found for method: $paymentMethod");
                    // Log all available keys for debugging
                    if (isset($paymentDetails['transaction'])) {
                        if (is_array($paymentDetails['transaction'])) {
                            error_log("Available transaction keys: " . implode(', ', array_keys($paymentDetails['transaction'])));
                        } else {
                            error_log("Transaction is string: " . $paymentDetails['transaction']);
                        }
                    }
                }
            } else {
                error_log("No payment details provided");
            }
            
            $stmt = $pdo->prepare("
                INSERT INTO orders (
                    user_id, product_id, quantity, status, 
                    total_amount, payment_status, payment_transaction_id, 
                    payment_reference, payment_completed_at, payment_method,
                    payment_account_number, shipping_address, contact_phone, notes, order_type,
                    order_number, vendor_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            
            $stmt->execute([
                $transaction['user_id'],
                $item['product_id'] ?? 'sample_product',
                $item['quantity'] ?? 1,
                'confirmed', // Auto-confirm on successful payment
                $item['price'] * ($item['quantity'] ?? 1),
                'paid',
                $transaction['paystack_transaction_id'],
                $reference,
                date('Y-m-d H:i:s'),
                $paymentMethod,
                $paymentAccountNumber,
                $checkoutData['shipping_address'] ?? 'Default Address',
                $checkoutData['contact_phone'] ?? 'Default Phone',
                $checkoutData['notes'] ?? 'Order from payment',
                'cart',
                $orderNumber,
                $vendorId
            ]);
            
            $orderIds[] = $pdo->lastInsertId();
            error_log("Created order ID: " . end($orderIds) . " for product: " . ($item['product_name'] ?? 'Unknown') . " with vendor: " . $vendorId);
        }
        
        // Update payment transaction with order IDs and success status
        $stmt = $pdo->prepare("
            UPDATE payment_transactions SET 
                payment_status = 'success',
                paystack_paid_at = NOW(),
                order_id = ?,
                payment_method = 'card',
                gateway_response = ?
            WHERE paystack_reference = ?
        ");
        $stmt->execute([
            $orderIds[0], 
            json_encode(['order_ids' => $orderIds, 'verified_at' => date('Y-m-d H:i:s'), 'payment_channel' => 'card']), 
            $reference
        ]);
        
        error_log("Payment verification completed for reference: $reference, created " . count($orderIds) . " orders");
        
        // Send order confirmation emails
        foreach ($orderIds as $orderId) {
            error_log("=== SENDING EMAILS FOR ORDER ID: $orderId ===");
            $emailResult = sendOrderConfirmationEmail($orderId);
            error_log("Email result for order $orderId: " . ($emailResult ? 'SUCCESS' : 'FAILED'));
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Payment verified and orders created successfully',
            'reference' => $reference,
            'order_ids' => $orderIds,
            'order_count' => count($orderIds)
        ]);
        
    } catch (Exception $e) {
        error_log("Manual verification error: " . $e->getMessage());
        error_log("Manual verification trace: " . $e->getTraceAsString());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to verify payment: ' . $e->getMessage()]);
    } catch (Error $e) {
        error_log("Manual verification fatal error: " . $e->getMessage());
        error_log("Manual verification fatal trace: " . $e->getTraceAsString());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'System error during payment verification']);
    }
}

// Send order confirmation email
function sendOrderConfirmationEmail($orderId) {
    global $pdo;
    
    try {
        error_log("=== SEND ORDER CONFIRMATION EMAIL STARTING ===");
        error_log("Order ID: $orderId");
        
        // Get order details with user info
        $stmt = $pdo->prepare("
            SELECT o.*, up.email as user_email, up.full_name as user_name 
            FROM orders o 
            LEFT JOIN user_profiles up ON o.user_id = up.id 
            WHERE o.id = ?
        ");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$order) {
            error_log("Order not found for email: $orderId");
            return false;
        }
        
        if (!$order['user_email']) {
            error_log("User email not found for order: $orderId");
            return false;
        }
        
        error_log("Order found: " . print_r($order, true));
        
        // Load email configuration and templates
        require_once __DIR__ . '/../config/email.php';
        require_once __DIR__ . '/../config/email_templates.php';
        
        // Prepare data for email template
        $data = [
            'order' => $order,
            'customer' => [
                'name' => $order['user_name'] ?: 'Customer',
                'email' => $order['user_email']
            ]
        ];
        
        // Send customer email
        error_log("=== SENDING CUSTOMER EMAIL ===");
        $customerResult = sendStyledEmail($order['user_email'], 'order_confirmation', $data);
        
        // Send vendor notification email
        error_log("=== SENDING VENDOR EMAIL ===");
        $vendorResult = sendVendorNotificationEmail($orderId, $order);
        
        if ($customerResult) {
            error_log("✅ Order confirmation email sent to: {$order['user_email']} for order: $orderId");
        } else {
            error_log("❌ Failed to send order confirmation email to: {$order['user_email']} for order: $orderId");
        }
        
        if ($vendorResult) {
            error_log("✅ Vendor notification email sent for order: $orderId");
        } else {
            error_log("❌ Failed to send vendor notification email for order: $orderId");
        }
        
        return $customerResult && $vendorResult;
        
    } catch (Exception $e) {
        error_log("Email sending error for order $orderId: " . $e->getMessage());
        return false;
    }
}

// Send vendor notification email
function sendVendorNotificationEmail($orderId, $order) {
    global $pdo;
    
    try {
        // Get vendor details - vendors table doesn't have email, so join with user_profiles
        $stmt = $pdo->prepare("
            SELECT v.farm_name, up.email, up.full_name, up.phone
            FROM vendors v 
            LEFT JOIN user_profiles up ON v.user_id = up.id
            WHERE v.id = ?
        ");
        $stmt->execute([$order['vendor_id']]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$vendor || !$vendor['email']) {
            error_log("Vendor email not found for order: $orderId, vendor_id: {$order['vendor_id']}");
            error_log("Vendor query result: " . print_r($vendor, true));
            return false;
        }
        
        // Get order items for vendor email (join with products to get product names)
        $stmt = $pdo->prepare("
            SELECT p.product_name, o.quantity, o.price as unit_price, 
                   (o.quantity * o.price) as total_amount
            FROM orders o
            LEFT JOIN products p ON o.product_id = p.id
            WHERE o.payment_reference = ? AND o.vendor_id = ? AND o.id = ?
        ");
        $stmt->execute([$order['payment_reference'], $order['vendor_id'], $orderId]);
        $orderItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Load email configuration and templates
        require_once __DIR__ . '/../config/email.php';
        require_once __DIR__ . '/../config/email_templates.php';
        
        // Prepare complete data for vendor email template
        $data = [
            'order' => [
                'order_number' => $order['order_number'],
                'customer_name' => $order['user_name'] ?: 'Customer',
                'created_at' => $order['created_at'],
                'shipping_address' => $order['shipping_address'],
                'contact_phone' => $order['contact_phone'],
                'items' => $orderItems
            ],
            'vendor' => [
                'name' => $vendor['farm_name'], // Template expects 'name'
                'farm_name' => $vendor['farm_name'],
                'email' => $vendor['email'],
                'contact_person' => $vendor['full_name']
            ],
            'customer' => [
                'name' => $order['user_name'] ?: 'Customer',
                'email' => $order['user_email']
            ]
        ];
        
        // Send vendor email
        $result = sendStyledEmail($vendor['email'], 'vendor_notification', $data);
        
        if ($result) {
            error_log("✅ Vendor notification email sent to: {$vendor['email']} for order: $orderId");
            error_log("Vendor email data: " . print_r($data, true));
        } else {
            error_log("❌ Failed to send vendor notification email to: {$vendor['email']} for order: $orderId");
        }
        
        return $result;
        
    } catch (Exception $e) {
        error_log("Vendor email sending error for order $orderId: " . $e->getMessage());
        return false;
    }
}

// Handle Paystack webhook
function handlePaystackWebhook() {
    global $pdo;
    
    try {
        $payload = json_decode(file_get_contents('php://input'), true);
        $signature = $_SERVER['HTTP_X_PAYSTACK_SIGNATURE'] ?? '';
        
        error_log("=== PAYSTACK WEBHOOK RECEIVED ===");
        error_log("Webhook payload: " . print_r($payload, true));
        error_log("Webhook signature: " . $signature);

        // Load Paystack config
        require_once __DIR__ . '/../config/paystack_config.php';
        
        // Verify webhook signature for security
        if (PAYSTACK_SECRET_KEY) {
            $expected_signature = hash_hmac('sha512', json_encode($payload), PAYSTACK_SECRET_KEY);

            if ($signature !== $expected_signature) {
                error_log('Invalid webhook signature received');
                http_response_code(400);
                echo json_encode(['error' => 'Invalid signature']);
                return;
            }
        }

        error_log("Webhook signature verified successfully");

        // Store webhook data first (source of truth)
        $stmt = $pdo->prepare("
            INSERT INTO payment_webhooks (
                paystack_event_id, event_type, transaction_reference,
                webhook_data, processed_at, created_at
            ) VALUES (?, ?, ?, ?, NOW(), NOW())
        ");
        $stmt->execute([
            $payload['id'] ?? null,
            $payload['event'] ?? null,
            $payload['data']['reference'] ?? null,
            json_encode($payload)
        ]);

        // Process webhook based on event type
        if ($payload['event'] === 'charge.success') {
            $reference = $payload['data']['reference'];
            error_log("Webhook charge.success received for reference: $reference");

            // Update payment status - webhook is the source of truth
            $stmt = $pdo->prepare("
                UPDATE payment_transactions SET
                    payment_status = 'success',
                    payment_method = ?, -- Use actual payment method from Paystack
                    paystack_paid_at = ?,
                    gateway_response = ?,
                    updated_at = NOW()
                WHERE paystack_reference = ? -- Use Paystack reference
            ");
            $stmt->execute([
                $payload['data']['channel'] ?? 'paystack', // Use actual payment channel (card, bank, mobile_money, etc.)
                $payload['data']['paid_at'] ?? null,
                json_encode($payload),
                $reference
            ]);

            // If no transaction found by Paystack reference, try our generated reference
            if ($stmt->rowCount() === 0) {
                error_log("No transaction found by Paystack reference $reference, trying generated reference");
                $stmt = $pdo->prepare("
                    UPDATE payment_transactions SET
                        payment_status = 'success',
                        payment_method = ?, -- Use actual payment method from Paystack
                        paystack_paid_at = ?,
                        gateway_response = ?,
                        updated_at = NOW()
                    WHERE transaction_reference = ? -- Try our generated reference
                ");
                $stmt->execute([
                    $payload['data']['channel'] ?? 'paystack', // Use actual payment channel
                    $payload['data']['paid_at'] ?? null,
                    json_encode($payload),
                    $reference
                ]);
            }

            // Update order status
            $stmt = $pdo->prepare("SELECT order_id FROM payment_transactions WHERE transaction_reference = ?");
            $stmt->execute([$reference]);
            $transaction = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($transaction) {
                $stmt = $pdo->prepare("
                    UPDATE orders SET
                        payment_status = 'paid',
                        payment_transaction_id = ?,
                        payment_completed_at = NOW(),
                        payment_reference = ?,
                        updated_at = NOW()
                    WHERE id = ?
                ");
                $stmt->execute([
                    $payload['data']['id'],
                    $reference,
                    $transaction['order_id']
                ]);
            }
        } elseif ($payload['event'] === 'charge.failed') {
            // Handle failed payments
            $reference = $payload['data']['reference'];
            $stmt = $pdo->prepare("
                UPDATE payment_transactions SET
                    payment_status = 'failed',
                    gateway_response = ?,
                    updated_at = NOW()
                WHERE transaction_reference = ?
            ");
            $stmt->execute([json_encode($payload), $reference]);
        }

        // Always respond with 200 to acknowledge receipt
        echo json_encode(['success' => true, 'received' => true]);

    } catch (Exception $e) {
        error_log("Webhook processing error: " . $e->getMessage());
        // Still return 200 to prevent Paystack from retrying
        http_response_code(200);
        echo json_encode(['success' => false, 'error' => 'Processing failed but acknowledged']);
    }
}

// Get payment status for an order
function handleGetPaymentStatus($orderId) {
    global $pdo;
    
    try {
        $headers = getallheaders();
        $auth_header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        $token = str_replace('Bearer ', '', $auth_header);
        
        if (!$token) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Authorization required']);
            return;
        }

        $user_data = validateJWT($token);
        if (!$user_data) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Invalid token']);
            return;
        }

        $user_id = $user_data['user_id'];

        $stmt = $pdo->prepare("
            SELECT
                o.id, o.payment_status, o.payment_transaction_id,
                o.payment_reference, o.payment_completed_at,
                pt.transaction_reference, pt.paystack_transaction_id,
                pt.paystack_paid_at, pt.gateway_response
            FROM orders o
            LEFT JOIN payment_transactions pt ON o.id = pt.order_id
            WHERE o.id = ? AND o.user_id = ?
        ");
        $stmt->execute([$orderId, $user_id]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Order not found']);
            return;
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'order_id' => $order['id'],
                'payment_status' => $order['payment_status'],
                'payment_reference' => $order['payment_reference'],
                'transaction_id' => $order['paystack_transaction_id'],
                'paid_at' => $order['paystack_paid_at'],
                'completed_at' => $order['payment_completed_at'],
                'gateway_response' => $order['gateway_response'] ? json_decode($order['gateway_response']) : null
            ]
        ]);

    } catch (Exception $e) {
        error_log("Get payment status error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to get payment status']);
    }
}
?>
