<?php
// Email Queue System - Background Job Processing
// Based on production best practices for reliable email delivery

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/email.php';
require_once __DIR__ . '/../utils/system_logs.php';

/**
 * Safe logging function - only logs if logSystemEvent exists
 */
function safeLog($action, $message, $data = []) {
    if (function_exists('logSystemEvent')) {
        logSystemEvent($action, $message, $data);
    }
}

/**
 * Queue an email for background processing (with local development fallback)
 */
function queueEmail($type, $recipient, $templateType, $templateData, $priority = 'normal') {
    global $pdo;

    // Check if we should send emails synchronously (local development fallback)
    $sendSynchronously = shouldSendEmailsSynchronously();

    try {
        $stmt = $pdo->prepare("
            INSERT INTO email_jobs (
                job_type, recipient_email, template_type, template_data,
                priority, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW())
        ");

        $stmt->execute([
            $type, // 'customer_order_confirmation', 'vendor_new_order', etc.
            $recipient,
            $templateType,
            json_encode($templateData),
            $priority
        ]);

        $jobId = $pdo->lastInsertId();
        safeLog('email_queued', "Email queued: {$type} to {$recipient}", [
            'job_id' => $jobId,
            'recipient' => $recipient,
            'type' => $type,
            'sync_fallback' => $sendSynchronously
        ]);

        // LOCAL DEVELOPMENT FALLBACK: Send immediately if no cron job is running
        if ($sendSynchronously) {
            safeLog('email_sync_fallback', "Sending email synchronously (local development)", [
                'job_id' => $jobId,
                'recipient' => $recipient,
                'type' => $type
            ]);

            $result = processEmailJob([
                'id' => $jobId,
                'job_type' => $type,
                'recipient_email' => $recipient,
                'template_type' => $templateType,
                'template_data' => json_encode($templateData)
            ]);

            if ($result['success']) {
                // Mark as completed
                $updateStmt = $pdo->prepare("
                    UPDATE email_jobs
                    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
                    WHERE id = ?
                ");
                $updateStmt->execute([$jobId]);

                safeLog('email_sync_sent', "Email sent synchronously", [
                    'job_id' => $jobId,
                    'recipient' => $recipient
                ]);
            } else {
                // Mark as failed
                $updateStmt = $pdo->prepare("
                    UPDATE email_jobs
                    SET status = 'failed', error_message = ?, updated_at = NOW()
                    WHERE id = ?
                ");
                $updateStmt->execute([$result['error'], $jobId]);

                safeLog('email_sync_failed', "Email sync send failed", [
                    'job_id' => $jobId,
                    'recipient' => $recipient,
                    'error' => $result['error']
                ]);
            }
        }

        return $jobId;
    } catch (Exception $e) {
        safeLog('email_queue_error', "Failed to queue email: {$type} to {$recipient}", [
            'error' => $e->getMessage(),
            'recipient' => $recipient,
            'type' => $type
        ]);
        return false;
    }
}

/**
 * Determine if emails should be sent synchronously (local development)
 */
function shouldSendEmailsSynchronously() {
    // Check environment - if local/development and no recent cron job activity
    $appEnv = getenv('APP_ENV') ?: 'development';

    if ($appEnv === 'production') {
        return false; // Always use queue in production
    }

    // Check if cron job has run recently (last 5 minutes)
    global $pdo;
    try {
        $stmt = $pdo->prepare("
            SELECT id FROM email_queue_logs
            WHERE created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
            LIMIT 1
        ");
        $stmt->execute();

        if ($stmt->fetch()) {
            return false; // Cron job is running, use queue
        }
    } catch (Exception $e) {
        // If we can't check, assume synchronous sending
    }

    // Check if there are very old pending emails (indicates no cron job)
    try {
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as old_jobs FROM email_jobs
            WHERE status = 'pending'
            AND created_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
        ");
        $stmt->execute();
        $result = $stmt->fetch();

        if ($result && $result['old_jobs'] > 0) {
            return true; // Old pending emails = no cron job, use sync
        }
    } catch (Exception $e) {
        // If we can't check, assume synchronous sending
    }

    return true; // Default to synchronous for local development
}

/**
 * Process pending email jobs (called by cron/background worker)
 */
function processEmailQueue($maxJobs = 10) {
    global $pdo;

    try {
        // Get pending jobs ordered by priority and creation time
        $stmt = $pdo->prepare("
            SELECT * FROM email_jobs
            WHERE status = 'pending'
            ORDER BY
                CASE priority
                    WHEN 'urgent' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'normal' THEN 3
                    WHEN 'low' THEN 4
                END,
                created_at ASC
            LIMIT ?
            FOR UPDATE
        ");

        $stmt->execute([$maxJobs]);
        $jobs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($jobs)) {
            return ['processed' => 0, 'successful' => 0, 'failed' => 0];
        }

        $processed = 0;
        $successful = 0;
        $failed = 0;

        foreach ($jobs as $job) {
            $processed++;

            // Mark job as processing
            $updateStmt = $pdo->prepare("
                UPDATE email_jobs
                SET status = 'processing', updated_at = NOW()
                WHERE id = ?
            ");
            $updateStmt->execute([$job['id']]);

            // Process the email
            $result = processEmailJob($job);

            if ($result['success']) {
                $successful++;
                // Mark as completed
                $updateStmt = $pdo->prepare("
                    UPDATE email_jobs
                    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
                    WHERE id = ?
                ");
                $updateStmt->execute([$job['id']]);

                safeLog('email_sent', "Email sent successfully: {$job['job_type']} to {$job['recipient_email']}", [
                    'job_id' => $job['id'],
                    'recipient' => $job['recipient_email'],
                    'type' => $job['job_type']
                ]);
            } else {
                $failed++;
                // Check retry count
                $retryCount = $job['retry_count'] + 1;
                $maxRetries = 3;

                if ($retryCount >= $maxRetries) {
                    // Mark as failed
                    $updateStmt = $pdo->prepare("
                        UPDATE email_jobs
                        SET status = 'failed', retry_count = ?, error_message = ?, updated_at = NOW()
                        WHERE id = ?
                    ");
                    $updateStmt->execute([$retryCount, $result['error'], $job['id']]);

                    safeLog('email_failed_permanently', "Email failed permanently: {$job['job_type']} to {$job['recipient_email']}", [
                        'job_id' => $job['id'],
                        'recipient' => $job['recipient_email'],
                        'error' => $result['error'],
                        'retries' => $retryCount
                    ]);
                } else {
                    // Schedule retry with exponential backoff
                    $retryDelay = pow(2, $retryCount - 1) * 60; // 1min, 2min, 4min
                    $nextRetry = date('Y-m-d H:i:s', strtotime("+{$retryDelay} minutes"));

                    $updateStmt = $pdo->prepare("
                        UPDATE email_jobs
                        SET status = 'pending', retry_count = ?, next_retry_at = ?, error_message = ?, updated_at = NOW()
                        WHERE id = ?
                    ");
                    $updateStmt->execute([$retryCount, $nextRetry, $result['error'], $job['id']]);

                    safeLog('email_retry_scheduled', "Email retry scheduled: {$job['job_type']} to {$job['recipient_email']}", [
                        'job_id' => $job['id'],
                        'recipient' => $job['recipient_email'],
                        'retry_count' => $retryCount,
                        'next_retry' => $nextRetry
                    ]);
                }
            }
        }

        return [
            'processed' => $processed,
            'successful' => $successful,
            'failed' => $failed
        ];

    } catch (Exception $e) {
        safeLog('email_queue_processor_error', "Email queue processor error: " . $e->getMessage(), [
            'error' => $e->getTraceAsString()
        ]);
        return ['processed' => 0, 'successful' => 0, 'failed' => 0, 'error' => $e->getMessage()];
    }
}

/**
 * Process a single email job
 */
function processEmailJob($job) {
    try {
        // Decode template data
        $templateData = json_decode($job['template_data'], true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return [
                'success' => false,
                'error' => 'Invalid template data JSON: ' . json_last_error_msg()
            ];
        }

        // Send the email
        $result = sendStyledEmail(
            $job['recipient_email'],
            $job['template_type'],
            $templateData
        );

        if ($result) {
            return ['success' => true];
        } else {
            return [
                'success' => false,
                'error' => 'Email sending function returned false'
            ];
        }

    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => 'Exception during email processing: ' . $e->getMessage()
        ];
    }
}

/**
 * Get email queue statistics
 */
function getEmailQueueStats() {
    global $pdo;

    try {
        $stmt = $pdo->query("
            SELECT
                status,
                COUNT(*) as count
            FROM email_jobs
            GROUP BY status
        ");

        $stats = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $stats[$row['status']] = (int)$row['count'];
        }

        return [
            'success' => true,
            'stats' => $stats,
            'total' => array_sum($stats)
        ];

    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Clean up old completed/failed email jobs (keep last 30 days)
 */
function cleanupEmailQueue($daysToKeep = 30) {
    global $pdo;

    try {
        $stmt = $pdo->prepare("
            DELETE FROM email_jobs
            WHERE status IN ('completed', 'failed')
            AND created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        ");

        $stmt->execute([$daysToKeep]);
        $deletedCount = $stmt->rowCount();

        safeLog('email_queue_cleanup', "Cleaned up {$deletedCount} old email jobs", [
            'deleted_count' => $deletedCount,
            'days_kept' => $daysToKeep
        ]);

        return ['success' => true, 'deleted' => $deletedCount];

    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => $e->getMessage()
        ];
    }
}

/**
 * Helper functions for queuing specific email types
 */
function findExistingEmailJob($templateType, $recipientEmail, $paymentReference) {
    global $pdo;

    if (!$paymentReference || !$recipientEmail || !$templateType) {
        return null;
    }

    try {
        $like = '%"payment_reference":"' . $paymentReference . '"%';
        $stmt = $pdo->prepare("
            SELECT id, status
            FROM email_jobs
            WHERE template_type = ?
              AND recipient_email = ?
              AND template_data LIKE ?
            ORDER BY id DESC
            LIMIT 1
        ");
        $stmt->execute([$templateType, $recipientEmail, $like]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    } catch (Exception $e) {
        return null;
    }
}

function queueOrderConfirmationEmail($orderId) {
    global $pdo;

    try {
        // Get order details with payment reference
        $stmt = $pdo->prepare("
            SELECT o.*, up.email as user_email, up.full_name as user_name
            FROM orders o
            LEFT JOIN user_profiles up ON o.user_id = up.id
            WHERE o.id = ?
        ");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$order || empty($order['user_email'])) {
            error_log("Cannot queue customer email - no order or email found for order ID: $orderId");
            return false;
        }

        $paymentReference = $order['payment_reference'];
        error_log("Queuing customer email for order $orderId with payment reference: $paymentReference");

        // Get ALL orders for this payment reference to show complete order summary
        $stmt = $pdo->prepare("
            SELECT o.*, p.name as product_name, p.price as product_price, v.farm_name as vendor_name
            FROM orders o
            LEFT JOIN products p ON o.product_id = p.id
            LEFT JOIN vendors v ON o.vendor_id = v.id
            WHERE o.payment_reference = ?
            ORDER BY o.id
        ");
        $stmt->execute([$paymentReference]);
        $allOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Calculate aggregated totals including delivery fee
        $subtotal = 0;
        $totalDeliveryFee = 0;
        $totalAmount = 0;
        $orderItems = [];
        foreach ($allOrders as $orderItem) {
            $itemSubtotal = $orderItem['subtotal'] ?? $orderItem['total_amount'];
            $itemDeliveryFee = $orderItem['delivery_fee'] ?? 0;
            $subtotal += $itemSubtotal;
            $totalDeliveryFee += $itemDeliveryFee;
            $totalAmount += $orderItem['total_amount'];
            
            // Calculate unit price from subtotal and quantity
            $unitPrice = $orderItem['unit_price'] ?? ($itemSubtotal / max($orderItem['quantity'], 1));
            
            $orderItems[] = [
                'product_name' => $orderItem['product_name'] ?: 'Poultry Product',
                'vendor_name' => $orderItem['vendor_name'] ?: 'Verified Vendor',
                'quantity' => $orderItem['quantity'],
                'unit_price' => floatval($unitPrice),
                'total_amount' => $itemSubtotal // Show item subtotal without delivery fee
            ];
        }

        error_log("Customer email will include " . count($orderItems) . " items with subtotal: KSH $subtotal, delivery: KSH $totalDeliveryFee, total: KSH $totalAmount");

        $templateData = [
            'order' => [
                'order_number' => $order['order_number'],
                'payment_reference' => $paymentReference,
                'subtotal' => $subtotal,
                'delivery_fee' => $totalDeliveryFee,
                'total_amount' => $totalAmount,
                'payment_method' => $order['payment_method'],
                'payment_status' => $order['payment_status'],
                'status' => $order['status'] ?: 'pending',
                'created_at' => $order['created_at'],
                'shipping_address' => $order['shipping_address'],
                'contact_phone' => $order['contact_phone'],
                'items' => $orderItems
            ],
            'customer' => [
                'name' => $order['user_name'] ?: 'Customer',
                'email' => $order['user_email']
            ]
        ];

        $existing = findExistingEmailJob('order_confirmation', $order['user_email'], $paymentReference);
        if ($existing && in_array($existing['status'], ['pending', 'processing', 'completed'], true)) {
            error_log("Customer email already queued/sent (job {$existing['id']}) for payment reference: $paymentReference");
            // Still ensure vendor emails are queued if missing
            queueVendorEmailsForPayment($paymentReference, $order);
            return $existing['id'];
        }

        // Queue customer email
        $customerJobId = queueEmail(
            'customer_order_confirmation',
            $order['user_email'],
            'order_confirmation',
            $templateData,
            'high'
        );

        error_log("Customer email queued with job ID: $customerJobId");

        // Queue vendor emails for ALL vendors in this payment
        queueVendorEmailsForPayment($paymentReference, $order);

        return $customerJobId;

    } catch (Exception $e) {
        error_log("Failed to queue order confirmation for order {$orderId}: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        safeLog('queue_order_confirmation_error', "Failed to queue order confirmation for order {$orderId}", [
            'error' => $e->getMessage(),
            'order_id' => $orderId
        ]);
        return false;
    }
}

/**
 * Queue vendor emails for all vendors in a payment reference
 */
function queueVendorEmailsForPayment($paymentReference, $customerOrder) {
    global $pdo;

    try {
        error_log("=== QUEUING VENDOR EMAILS FOR PAYMENT: $paymentReference ===");

        // Get all unique vendors for this payment reference
        $stmt = $pdo->prepare("
            SELECT DISTINCT o.vendor_id, v.farm_name, up.email, up.full_name
            FROM orders o
            LEFT JOIN vendors v ON o.vendor_id = v.id
            LEFT JOIN user_profiles up ON v.user_id = up.id
            WHERE o.payment_reference = ? AND o.vendor_id IS NOT NULL
        ");
        $stmt->execute([$paymentReference]);
        $vendors = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($vendors)) {
            error_log("❌ ERROR: No vendors found to notify for payment reference: $paymentReference");
            return false;
        }

        error_log("✅ Found " . count($vendors) . " vendor(s) to notify for $paymentReference");

        $queuedCount = 0;

        foreach ($vendors as $vendor) {
            if (empty($vendor['email'])) {
                error_log("Vendor {$vendor['vendor_id']} has no email - skipping");
                continue;
            }

            error_log("Processing vendor: {$vendor['farm_name']} ({$vendor['email']})");

            // Get all order items for this vendor with product price
            $stmt = $pdo->prepare("
                SELECT o.*, p.name as product_name, p.price as product_price
                FROM orders o
                LEFT JOIN products p ON o.product_id = p.id
                WHERE o.payment_reference = ? AND o.vendor_id = ?
                ORDER BY o.id
            ");
            $stmt->execute([$paymentReference, $vendor['vendor_id']]);
            $orderItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($orderItems)) {
                error_log("No order items found for vendor {$vendor['vendor_id']}");
                continue;
            }

            // Calculate vendor's total
            $vendorTotal = 0;
            $items = [];
            foreach ($orderItems as $item) {
                $vendorTotal += $item['subtotal'] ?? $item['total_amount'];
                // Use product_price from products table, fallback to subtotal/quantity
                $unitPrice = $item['product_price'] ?? (($item['subtotal'] ?? $item['total_amount']) / max($item['quantity'], 1));
                $items[] = [
                    'product_name' => $item['product_name'],
                    'quantity' => $item['quantity'],
                    'unit_price' => floatval($unitPrice),
                    'total_amount' => $item['subtotal'] ?? $item['total_amount']
                ];
                error_log("Vendor email item: {$item['product_name']}, Unit Price: {$unitPrice}, Quantity: {$item['quantity']}, Total: " . ($item['subtotal'] ?? $item['total_amount']));
            }

            error_log("Vendor {$vendor['farm_name']} has " . count($items) . " items totaling KSH " . $vendorTotal);

            $templateData = [
                'order' => [
                    'order_number' => $orderItems[0]['order_number'],
                    'payment_reference' => $paymentReference,
                    'customer_name' => $customerOrder['user_name'] ?: 'Customer',
                    'created_at' => $orderItems[0]['created_at'],
                    'shipping_address' => $orderItems[0]['shipping_address'],
                    'contact_phone' => $orderItems[0]['contact_phone'],
                    'total_amount' => $vendorTotal,
                    'items' => $items
                ],
                'vendor' => [
                    'name' => $vendor['farm_name'],
                    'farm_name' => $vendor['farm_name'],
                    'email' => $vendor['email'],
                    'contact_person' => $vendor['full_name']
                ]
            ];

            $existing = findExistingEmailJob('vendor_notification', $vendor['email'], $paymentReference);
            if ($existing && in_array($existing['status'], ['pending', 'processing', 'completed'], true)) {
                error_log("Vendor email already queued/sent (job {$existing['id']}) for {$vendor['farm_name']} payment: $paymentReference");
                continue;
            }

            $jobId = queueEmail(
                'vendor_new_order',
                $vendor['email'],
                'vendor_notification',
                $templateData,
                'high'
            );

            if ($jobId) {
                $queuedCount++;
                error_log("✅ Vendor email queued for {$vendor['farm_name']} with job ID: $jobId");
            } else {
                error_log("❌ Failed to queue vendor email for {$vendor['farm_name']}");
            }
        }

        error_log("=== VENDOR EMAIL QUEUING COMPLETE: $queuedCount emails queued ===");
        return $queuedCount > 0;

    } catch (Exception $e) {
        error_log("Error queuing vendor emails for payment $paymentReference: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        return false;
    }
}

function queueVendorOrderNotification($orderId, $vendorId) {
    global $pdo;

    try {
        // Get vendor details
        $stmt = $pdo->prepare("
            SELECT v.farm_name, up.email, up.full_name
            FROM vendors v
            LEFT JOIN user_profiles up ON v.user_id = up.id
            WHERE v.id = ?
        ");
        $stmt->execute([$vendorId]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$vendor || empty($vendor['email'])) {
            return false;
        }

        // Get order details for this vendor
        $stmt = $pdo->prepare("
            SELECT o.*, p.name as product_name, p.price as unit_price
            FROM orders o
            LEFT JOIN products p ON o.product_id = p.id
            WHERE o.id = ? AND o.vendor_id = ?
        ");
        $stmt->execute([$orderId, $vendorId]);
        $orderItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($orderItems)) {
            return false;
        }

        $templateData = [
            'order' => [
                'order_number' => $orderItems[0]['order_number'],
                'customer_name' => 'Customer',
                'created_at' => $orderItems[0]['created_at'],
                'shipping_address' => $orderItems[0]['shipping_address'],
                'contact_phone' => $orderItems[0]['contact_phone'],
                'items' => array_map(function($item) {
                    $quantity = $item['quantity'] ?: 1;
                    $unitPrice = $item['unit_price'] ?? ($item['subtotal'] ?? 0) / $quantity;
                    return [
                        'product_name' => $item['product_name'],
                        'quantity' => $item['quantity'],
                        'unit_price' => $unitPrice,
                        'total_amount' => $item['subtotal'] ?? $item['total_amount']
                    ];
                }, $orderItems)
            ],
            'vendor' => [
                'name' => $vendor['farm_name'],
                'farm_name' => $vendor['farm_name'],
                'email' => $vendor['email'],
                'contact_person' => $vendor['full_name']
            ]
        ];

        $paymentReference = $orderItems[0]['payment_reference'] ?? null;
        if ($paymentReference && !empty($vendor['email'])) {
            $existing = findExistingEmailJob('vendor_notification', $vendor['email'], $paymentReference);
            if ($existing && in_array($existing['status'], ['pending', 'processing', 'completed'], true)) {
                return $existing['id'];
            }
        }

        return queueEmail(
            'vendor_new_order',
            $vendor['email'],
            'vendor_notification',
            $templateData,
            'high'
        );

    } catch (Exception $e) {
        safeLog('queue_vendor_notification_error', "Failed to queue vendor notification for order {$orderId}, vendor {$vendorId}", [
            'error' => $e->getMessage(),
            'order_id' => $orderId,
            'vendor_id' => $vendorId
        ]);
        return false;
    }
}

?>
