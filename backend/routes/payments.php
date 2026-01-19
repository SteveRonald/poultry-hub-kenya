<?php
// Paystack Payment Gateway Routes

// Initialize Paystack transaction
function handleInitializePaystackPayment() {
    global $pdo;
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $order_id = $input['order_id'] ?? null;
        $amount = $input['amount'] ?? null;
        $email = $input['email'] ?? null;
        $callback_url = $input['callback_url'] ?? null;

        if (!$order_id || !$amount || !$email) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Missing required fields: order_id, amount, email'
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

        $user_data = verifyJWTToken($token);
        if (!$user_data) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Invalid token']);
            return;
        }

        $user_id = $user_data['user_id'];

        // Verify order exists and belongs to user
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
            'callback_url' => $callback_url ?: (getenv('APP_URL') ?: 'http://localhost:5173') . '/checkout/success'
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

        if ($http_code !== 200 || !$paystack_result['status']) {
            // Update transaction status to failed
            $stmt = $pdo->prepare("
                UPDATE payment_transactions SET
                    payment_status = 'failed',
                    gateway_response = ?,
                    updated_at = NOW()
                WHERE transaction_reference = ?
            ");
            $stmt->execute([$response, $reference]);

            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => $paystack_result['message'] ?? 'Payment initialization failed'
            ]);
            return;
        }

        // Update transaction with Paystack access code
        $stmt = $pdo->prepare("
            UPDATE payment_transactions SET
                paystack_access_code = ?,
                gateway_response = ?,
                updated_at = NOW()
            WHERE transaction_reference = ?
        ");
        $stmt->execute([
            $paystack_result['data']['access_code'],
            $response,
            $reference
        ]);

        echo json_encode([
            'success' => true,
            'data' => $paystack_result['data'],
            'public_key' => PAYSTACK_PUBLIC_KEY,
            'order_id' => $order_id,
            'reference' => $reference
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

        // Get transaction details
        $stmt = $pdo->prepare("SELECT * FROM payment_transactions WHERE transaction_reference = ?");
        $stmt->execute([$reference]);
        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$transaction) {
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

// Handle Paystack webhook
function handlePaystackWebhook() {
    global $pdo;
    
    try {
        $payload = json_decode(file_get_contents('php://input'), true);
        $signature = $_SERVER['HTTP_X_PAYSTACK_SIGNATURE'] ?? '';

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

            // Update payment status - webhook is the source of truth
            $stmt = $pdo->prepare("
                UPDATE payment_transactions SET
                    payment_status = 'success',
                    paystack_transaction_id = ?,
                    paystack_paid_at = ?,
                    gateway_response = ?,
                    updated_at = NOW()
                WHERE transaction_reference = ?
            ");
            $stmt->execute([
                $payload['data']['id'],
                $payload['data']['paid_at'] ?? null,
                json_encode($payload),
                $reference
            ]);

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

        $user_data = verifyJWTToken($token);
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
