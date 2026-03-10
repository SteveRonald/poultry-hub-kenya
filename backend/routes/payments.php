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

        // Extract checkout data for persistent storage
        $checkoutData = [
            'items' => $input['items'] ?? [],
            'shipping_address' => $input['shipping_address'] ?? '',
            'contact_phone' => $input['contact_phone'] ?? '',
            'notes' => $input['notes'] ?? '',
            'payment_method' => $input['payment_method'] ?? 'card'
        ];

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

        // Include checkout data in metadata for webhook processing
        $metadata = [
            'initialized_at' => date('Y-m-d H:i:s'),
            'checkout_data' => $checkoutData
        ];

        $stmt->execute([
            $reference,
            $order_id,
            $user_id,
            $amount,
            json_encode($metadata)
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

    // Ensure we never return an empty response on fatal errors
    ob_start();
    register_shutdown_function(function () {
        $error = error_get_last();
        if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
            // Log the fatal error details
            error_log(sprintf(
                "Fatal error during manual verification: Type: %d, Message: %s, File: %s, Line: %d",
                $error['type'],
                $error['message'],
                $error['file'],
                $error['line']
            ));
            
            if (!headers_sent()) {
                if (ob_get_length()) {
                    ob_clean();
                }
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Verification failed due to a server error. Please try again.'
                ]);
            }
        }
    });
    
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
        
        $pdo->beginTransaction();

        // Get the payment transaction
        $stmt = $pdo->prepare("SELECT * FROM payment_transactions WHERE paystack_reference = ? FOR UPDATE");
        $stmt->execute([$reference]);
        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$transaction) {
            $pdo->rollBack();
            error_log("Payment transaction not found for reference: $reference");
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Payment transaction not found']);
            return;
        }

        // Idempotency: if orders already exist for this payment reference, return them
        $stmt = $pdo->prepare("
            SELECT id, total_amount
            FROM orders
            WHERE payment_reference = ? AND user_id = ?
            ORDER BY created_at ASC
        ");
        $stmt->execute([$reference, $transaction['user_id']]);
        $existingOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (!empty($existingOrders)) {
            $orderIds = array_map(fn($row) => $row['id'], $existingOrders);
            $totalAmount = array_reduce($existingOrders, function($sum, $row) {
                return $sum + floatval($row['total_amount'] ?? 0);
            }, 0);

            if ($transaction['payment_status'] !== 'success') {
                $stmt = $pdo->prepare("
                    UPDATE payment_transactions SET 
                        payment_status = 'success',
                        paystack_paid_at = COALESCE(paystack_paid_at, NOW()),
                        updated_at = NOW()
                    WHERE paystack_reference = ?
                ");
                $stmt->execute([$reference]);
            }

            $pdo->commit();

            // Best-effort notifications (idempotent)
            try {
                require_once __DIR__ . '/../services/notifications/OrderNotificationService.php';

                $stmt = $pdo->prepare("
                    SELECT
                        o.id as order_id,
                        o.order_number,
                        o.product_id,
                        o.quantity,
                        o.total_amount,
                        o.delivery_fee,
                        o.vendor_id,
                        p.name as product_name,
                        p.price as unit_price,
                        vup.full_name as vendor_name,
                        vup.email as vendor_email,
                        cup.full_name as customer_name,
                        cup.phone as customer_phone,
                        cup.email as customer_email,
                        o.created_at
                    FROM orders o
                    LEFT JOIN products p ON o.product_id = p.id
                    LEFT JOIN vendors v ON o.vendor_id = v.id
                    LEFT JOIN user_profiles vup ON v.user_id = vup.id
                    LEFT JOIN user_profiles cup ON o.user_id = cup.id
                    WHERE o.payment_reference = ? AND o.user_id = ?
                    ORDER BY o.created_at ASC
                ");
                $stmt->execute([$reference, $transaction['user_id']]);
                $createdOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);

                $vendorGroups = [];
                foreach ($createdOrders as $o) {
                    $vid = $o['vendor_id'] ?? null;
                    if (!$vid) continue;
                    if (!isset($vendorGroups[$vid])) {
                        $vendorGroups[$vid] = [
                            'orders' => [],
                            'vendor_name' => $o['vendor_name'] ?? null,
                            'vendor_email' => $o['vendor_email'] ?? null
                        ];
                    }
                    $vendorGroups[$vid]['orders'][] = $o;
                }

                OrderNotificationService::orderCreated($pdo, $createdOrders, $vendorGroups, [
                    'order_number' => $createdOrders[0]['order_number'] ?? null,
                    'idempotency_group' => $reference,
                    'customer_id' => $transaction['user_id'],
                    'checkout_phone' => $createdOrders[0]['contact_phone'] ?? null,
                    'customer_profile_phone' => $createdOrders[0]['customer_phone'] ?? null
                ]);
            } catch (Exception $notifyError) {
                error_log("Retry verification: notifications failed: " . $notifyError->getMessage());
            }

            echo json_encode([
                'success' => true,
                'message' => 'Payment already verified and orders exist',
                'reference' => $reference,
                'order_ids' => $orderIds,
                'order_count' => count($orderIds),
                'amount' => $totalAmount,
                'payment_method' => $transaction['payment_method'] ?? 'paystack',
                'channel' => $transaction['payment_method'] ?? 'paystack',
                'selected_method' => $transaction['payment_method'] ?? 'paystack'
            ]);
            return;
        }
        
        if (!$checkoutData || !isset($checkoutData['items'])) {
            $pdo->rollBack();
            error_log("Checkout data missing for reference: $reference");
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Checkout data is required']);
            return;
        }
        
        error_log("Creating orders for " . count($checkoutData['items']) . " items");
        
        // Get payment details ONCE before the loop (not per item)
        $totalAmount = 0;
        $paymentMethod = 'card';
        $paymentChannel = 'card';
        $paymentAccountNumber = null;
        
        // Calculate total amount from checkout items (most reliable source)
        if ($checkoutData && isset($checkoutData['items'])) {
            foreach ($checkoutData['items'] as $item) {
                $itemTotal = ($item['price'] ?? 0) * ($item['quantity'] ?? 1);
                $totalAmount += $itemTotal;
            }
            error_log("Calculated total amount from items: $totalAmount");
        }
        
        if ($paymentDetails) {
            // Use selected_method first (user's selection), then fallback to channel
            $paymentMethod = $paymentDetails['selected_method'] ?? $paymentDetails['channel'] ?? 'card';
            $paymentChannel = $paymentDetails['channel'] ?? 'card';
            error_log("Payment method detected: $paymentMethod (selected_method: " . ($paymentDetails['selected_method'] ?? 'null') . ", channel: " . ($paymentDetails['channel'] ?? 'null') . ")");
            
            // Extract payment account number based on payment method
            if ($paymentMethod === 'mpesa' || $paymentMethod === 'mobile_money') {
                $phone = null;
                if (isset($paymentDetails['transaction']['mobile_money_number'])) {
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
        }
        
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
                
                if (!$vendorData) {
                    error_log("❌ ERROR: No product found in database for product_id: {$item['product_id']}");
                } else {
                    $vendorId = $vendorData['vendor_id'] ?? null;
                    if (!$vendorId) {
                        error_log("⚠️ WARNING: Product {$item['product_id']} has no vendor_assigned (vendor_id is null/empty)");
                    }
                }
                error_log("🛒 Processing Item - Product ID: {$item['product_id']}, Vendor ID: " . ($vendorId ?: 'NULL'));
            } else {
                error_log("❌ ERROR: No product_id found in item data: " . print_r($item, true));
            }
            
            // Calculate item subtotal and delivery fee (split proportionally across items)
            $itemSubtotal = $item['price'] * ($item['quantity'] ?? 1);
            $orderDeliveryFee = $checkoutData['delivery_fee'] ?? 0;
            $itemCount = count($checkoutData['items']);
            // Split delivery fee across items (first item gets any remainder)
            $itemDeliveryFee = ($itemCount > 0) ? floor($orderDeliveryFee / $itemCount) : 0;
            if ($item === $checkoutData['items'][0]) {
                $itemDeliveryFee = $orderDeliveryFee - ($itemDeliveryFee * ($itemCount - 1));
            }
            $itemTotalWithDelivery = $itemSubtotal + $itemDeliveryFee;
            
            $stmt = $pdo->prepare("
                INSERT INTO orders (
                    user_id, product_id, quantity, status, 
                    subtotal, delivery_fee, total_amount, payment_status, payment_transaction_id, 
                    payment_reference, payment_completed_at, payment_method,
                    payment_account_number, shipping_address, contact_phone, notes, order_type,
                    order_number, vendor_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            
            $stmt->execute([
                $transaction['user_id'],
                $item['product_id'] ?? 'sample_product',
                $item['quantity'] ?? 1,
                'confirmed', // Auto-confirm on successful payment
                $itemSubtotal,
                $itemDeliveryFee,
                $itemTotalWithDelivery,
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
        
        $pdo->commit();
        
        error_log("Payment verification completed for reference: $reference, created " . count($orderIds) . " orders");
        
        // Queue/send emails + SMS notifications (best-effort)
        try {
            require_once __DIR__ . '/../services/notifications/OrderNotificationService.php';

            // Fetch created orders for this payment reference to build a single notification payload
            $stmt = $pdo->prepare("
                SELECT
                    o.id as order_id,
                    o.order_number,
                    o.product_id,
                    o.quantity,
                    o.total_amount,
                    o.delivery_fee,
                    o.vendor_id,
                    p.name as product_name,
                    p.price as unit_price,
                    vup.full_name as vendor_name,
                    vup.email as vendor_email,
                    cup.full_name as customer_name,
                    cup.phone as customer_phone,
                    cup.email as customer_email,
                    o.created_at
                FROM orders o
                LEFT JOIN products p ON o.product_id = p.id
                LEFT JOIN vendors v ON o.vendor_id = v.id
                LEFT JOIN user_profiles vup ON v.user_id = vup.id
                LEFT JOIN user_profiles cup ON o.user_id = cup.id
                WHERE o.payment_reference = ? AND o.user_id = ?
                ORDER BY o.created_at ASC
            ");
            $stmt->execute([$reference, $transaction['user_id']]);
            $createdOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Group per vendor (used for vendor SMS/email)
            $vendorGroups = [];
            foreach ($createdOrders as $o) {
                $vid = $o['vendor_id'] ?? null;
                if (!$vid) continue;
                if (!isset($vendorGroups[$vid])) {
                    $vendorGroups[$vid] = [
                        'orders' => [],
                        'vendor_name' => $o['vendor_name'] ?? null,
                        'vendor_email' => $o['vendor_email'] ?? null
                    ];
                }
                $vendorGroups[$vid]['orders'][] = $o;
            }

            OrderNotificationService::orderCreated($pdo, $createdOrders, $vendorGroups, [
                // Use first order_number for display, but payment reference for idempotency grouping
                'order_number' => $createdOrders[0]['order_number'] ?? null,
                'idempotency_group' => $reference,
                'customer_id' => $transaction['user_id'],
                'checkout_phone' => $checkoutData['contact_phone'] ?? null,
                'customer_profile_phone' => $createdOrders[0]['customer_phone'] ?? null
            ]);
        } catch (Exception $notifyError) {
            error_log("Payment verified but notifications failed: " . $notifyError->getMessage());
        }

        echo json_encode([
            'success' => true,
            'message' => 'Payment verified and orders created successfully',
            'reference' => $reference,
            'order_ids' => $orderIds,
            'order_count' => count($orderIds),
            'amount' => $totalAmount,
            'payment_method' => $paymentMethod,
            'channel' => $paymentChannel,
            'selected_method' => $paymentDetails['selected_method'] ?? $paymentMethod
        ]);
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("Manual verification error: " . $e->getMessage());
        error_log("Manual verification trace: " . $e->getTraceAsString());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to verify payment: ' . $e->getMessage()]);
    } catch (Error $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
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

        // First, get the payment reference from this order
        $stmt = $pdo->prepare("SELECT payment_reference, user_id FROM orders WHERE id = ?");
        $stmt->execute([$orderId]);
        $orderInfo = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$orderInfo) {
            error_log("Order not found for email: $orderId");
            return false;
        }

        $paymentReference = $orderInfo['payment_reference'];
        $userId = $orderInfo['user_id'];

        error_log("Payment reference: $paymentReference, User ID: $userId");

        // Get ALL orders with the same payment reference (for multi-item orders)
        $stmt = $pdo->prepare("
            SELECT
                o.*,
                p.name as product_name,
                p.price as unit_price,
                v.farm_name as vendor_name,
                up.email as user_email,
                up.full_name as user_name
            FROM orders o
            LEFT JOIN products p ON o.product_id = p.id
            LEFT JOIN vendors v ON o.vendor_id = v.id
            LEFT JOIN user_profiles up ON o.user_id = up.id
            WHERE o.payment_reference = ? AND o.user_id = ?
            ORDER BY o.created_at ASC
        ");
        $stmt->execute([$paymentReference, $userId]);
        $orderRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($orderRecords)) {
            error_log("No orders found for payment reference: $paymentReference");
            return false;
        }

        // Use the first order record as the main order data
        $mainOrder = $orderRecords[0];

        if (!$mainOrder['user_email']) {
            error_log("User email not found for payment reference: $paymentReference");
            return false;
        }

        // Build order items array and calculate total
        $orderItems = [];
        $totalAmount = 0;

        foreach ($orderRecords as $orderRecord) {
            $itemTotal = $orderRecord['total_amount'];
            $totalAmount += $itemTotal;

            $orderItems[] = [
                'product_name' => $orderRecord['product_name'] ?: 'Product',
                'vendor_name' => $orderRecord['vendor_name'] ?: 'Vendor',
                'quantity' => $orderRecord['quantity'],
                'unit_price' => floatval($orderRecord['unit_price'] ?: 0),
                'total_amount' => floatval($itemTotal)
            ];
        }

        // Create enhanced order data with all items
        $enhancedOrder = $mainOrder;
        $enhancedOrder['items'] = $orderItems;
        $enhancedOrder['total_amount'] = $totalAmount;

        error_log("Enhanced order data prepared with total: KSH $totalAmount");

        // Load email configuration and templates
        require_once __DIR__ . '/../config/email.php';
        require_once __DIR__ . '/../config/email_templates.php';

        // Prepare data for email template
        $data = [
            'order' => $enhancedOrder,
            'customer' => [
                'name' => $mainOrder['user_name'] ?: 'Customer',
                'email' => $mainOrder['user_email']
            ]
        ];

        // Send customer email
        error_log("=== SENDING CUSTOMER EMAIL ===");
        $customerResult = sendStyledEmail($mainOrder['user_email'], 'order_confirmation', $data);

        // Send vendor notification email for ALL orders with same payment reference
        error_log("=== SENDING VENDOR EMAILS FOR ALL ORDERS ===");
        $vendorResult = sendVendorNotificationEmail($paymentReference, $enhancedOrder);
        
        if ($customerResult) {
            error_log("✅ Order confirmation email sent to: {$order['user_email']} for order: $orderId");
        } else {
            error_log("❌ Failed to send order confirmation email to: {$order['user_email']} for order: $orderId");
        }
        
        if ($vendorResult) {
            error_log("✅ Vendor notification email sent for payment reference: {$order['payment_reference']}");
        } else {
            error_log("❌ Failed to send vendor notification email for payment reference: {$order['payment_reference']}");
        }
        
        return $customerResult && $vendorResult;
        
    } catch (Exception $e) {
        error_log("Email sending error for order $orderId: " . $e->getMessage());
        error_log("Email error trace: " . $e->getTraceAsString());
        return false;
    }
}

// Send vendor notification email
function sendVendorNotificationEmail($paymentReference, $order) {
    global $pdo;
    
    try {
        // Get all orders for this payment reference to notify all vendors
        $stmt = $pdo->prepare("
            SELECT DISTINCT o.vendor_id, v.farm_name, up.email, up.full_name, up.phone
            FROM orders o
            LEFT JOIN vendors v ON o.vendor_id = v.id
            LEFT JOIN user_profiles up ON v.user_id = up.id
            WHERE o.payment_reference = ? AND o.vendor_id IS NOT NULL
        ");
        $stmt->execute([$paymentReference]);
        $vendors = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($vendors)) {
            error_log("No vendors found for payment reference: $paymentReference");
            return false;
        }
        
        error_log("Found " . count($vendors) . " vendors to notify for payment reference: $paymentReference");
        
        // Load email configuration and templates
        require_once __DIR__ . '/../config/email.php';
        require_once __DIR__ . '/../config/email_templates.php';
        
        $allVendorsNotified = true;
        
        // Send email to each vendor
        foreach ($vendors as $vendor) {
            if (!$vendor['email']) {
                error_log("Vendor has no email: " . print_r($vendor, true));
                $allVendorsNotified = false;
                continue;
            }
            
            // Get order items for this vendor
            $stmt = $pdo->prepare("
                SELECT p.product_name, o.quantity, o.price as unit_price, 
                       o.subtotal as total_amount, o.order_number
                FROM orders o
                LEFT JOIN products p ON o.product_id = p.id
                WHERE o.payment_reference = ? AND o.vendor_id = ?
            ");
            $stmt->execute([$paymentReference, $vendor['vendor_id']]);
            $orderItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (empty($orderItems)) {
                error_log("No order items found for vendor {$vendor['vendor_id']} with payment reference: $paymentReference");
                continue;
            }
            
            // Prepare complete data for vendor email template
            $data = [
                'order' => [
                    'order_number' => $orderItems[0]['order_number'],
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
                ]
            ];
            
            error_log("Sending vendor email to: " . $vendor['email'] . " for " . count($orderItems) . " items");
            
            // Send vendor email
            $result = sendStyledEmail($vendor['email'], 'vendor_notification', $data);
            
            if ($result) {
                error_log("✅ Vendor notification email sent to: {$vendor['email']} for payment reference: $paymentReference");
            } else {
                error_log("❌ Failed to send vendor notification email to: {$vendor['email']} for payment reference: $paymentReference");
                $allVendorsNotified = false;
            }
        }
        
        return $allVendorsNotified;
        
    } catch (Exception $e) {
        error_log("Vendor email sending error for payment reference $paymentReference: " . $e->getMessage());
        error_log("Vendor email error trace: " . $e->getTraceAsString());
        return false;
    }
}

// Get payment status for an order
function handleGetPaymentStatus($orderId) {
    global $pdo;

    try {
        // First, get the order and its payment reference
        $stmt = $pdo->prepare("
            SELECT o.*, u.full_name as customer_name, u.email as customer_email
            FROM orders o
            LEFT JOIN user_profiles u ON o.user_id = u.id
            WHERE o.id = ? OR o.order_number = ?
        ");
        $stmt->execute([$orderId, $orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$order) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'Order not found'
            ]);
            return;
        }

        $paymentReference = $order['payment_reference'];

        // Get all orders with the same payment reference to calculate total
        $stmt = $pdo->prepare("
            SELECT SUM(total_amount) as total_amount, COUNT(*) as item_count
            FROM orders
            WHERE payment_reference = ?
        ");
        $stmt->execute([$paymentReference]);
        $totalData = $stmt->fetch(PDO::FETCH_ASSOC);

        // Get payment transaction details
        $stmt = $pdo->prepare("
            SELECT pt.amount, pt.payment_status, pt.transaction_reference, pt.paystack_reference
            FROM payment_transactions pt
            WHERE pt.transaction_reference = ?
        ");
        $stmt->execute([$paymentReference]);
        $paymentTransaction = $stmt->fetch(PDO::FETCH_ASSOC);

        // Format the response
        $response = [
            'success' => true,
            'order_id' => $order['id'],
            'order_number' => $order['order_number'],
            'customer_name' => $order['customer_name'],
            'customer_email' => $order['customer_email'],
            'amount' => floatval($totalData['total_amount'] ?? 0),
            'paid_amount' => $paymentTransaction ? floatval($paymentTransaction['amount']) : null,
            'item_count' => intval($totalData['item_count'] ?? 0),
            'order_status' => $order['status'],
            'payment_status' => $order['payment_status'],
            'payment_method' => $order['payment_method'],
            'paystack_reference' => $paymentTransaction ? $paymentTransaction['paystack_reference'] : null,
            'transaction_reference' => $paymentReference,
            'created_at' => $order['created_at']
        ];

        echo json_encode($response);

    } catch (PDOException $e) {
        error_log("Error getting payment status: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to retrieve payment status'
        ]);
    }
}

?>
