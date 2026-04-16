<?php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/paystack_config.php';
require_once __DIR__ . '/system_logs.php';

function ensureVendorWallet($vendorId) {
    global $pdo;

    $stmt = $pdo->prepare("SELECT id FROM vendor_wallet WHERE vendor_id = ?");
    $stmt->execute([$vendorId]);
    $wallet = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($wallet) {
        return $wallet;
    }

    $stmt = $pdo->prepare("\n        INSERT INTO vendor_wallet (vendor_id, available_balance, pending_balance, total_earned, total_withdrawn)\n        VALUES (?, 0.00, 0.00, 0.00, 0.00)\n    ");
    $stmt->execute([$vendorId]);

    return ['id' => $pdo->lastInsertId(), 'vendor_id' => $vendorId];
}

function getVendorWallet($vendorId, $lockForUpdate = false) {
    global $pdo;

    $sql = "SELECT * FROM vendor_wallet WHERE vendor_id = ?";
    if ($lockForUpdate) {
        $sql .= " FOR UPDATE";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$vendorId]);
    $wallet = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($wallet) {
        return $wallet;
    }

    ensureVendorWallet($vendorId);
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$vendorId]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function getVendorRecipientCode($vendorId) {
    global $pdo;

    $stmt = $pdo->prepare("SELECT paystack_recipient_code FROM vendor_transfer_recipients WHERE vendor_id = ?");
    $stmt->execute([$vendorId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row['paystack_recipient_code'] ?? null;
}

function upsertVendorRecipientCode($vendorId, $recipientCode) {
    global $pdo;

    $stmt = $pdo->prepare("\n        INSERT INTO vendor_transfer_recipients (vendor_id, paystack_recipient_code)\n        VALUES (?, ?)\n        ON DUPLICATE KEY UPDATE paystack_recipient_code = VALUES(paystack_recipient_code), updated_at = NOW()\n    ");
    $stmt->execute([$vendorId, $recipientCode]);

    return true;
}

function createPaystackTransferRecipient(array $payload) {
    return sendPaystackJsonRequest(PAYSTACK_CREATE_TRANSFER_RECIPIENT, $payload);
}

function listPaystackBanks($country = 'kenya') {
    $query = http_build_query([
        'country' => $country,
        'perPage' => 200
    ]);

    return sendPaystackGetRequest(PAYSTACK_LIST_BANKS . '?' . $query);
}

function getPayoutAccountEncryptionKey() {
    $base = getenv('PAYOUT_ENCRYPTION_KEY') ?: (getenv('JWT_SECRET_KEY') ?: 'poultry-hub-default-key');
    return hash('sha256', $base, true);
}

function encryptPayoutAccountNumber($plainAccountNumber) {
    $key = getPayoutAccountEncryptionKey();
    $iv = random_bytes(16);
    $cipher = openssl_encrypt($plainAccountNumber, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);

    if ($cipher === false) {
        throw new Exception('Failed to encrypt payout account number');
    }

    return base64_encode($iv) . ':' . base64_encode($cipher);
}

function maskAccountNumber($accountNumber) {
    $sanitized = preg_replace('/\D+/', '', (string)$accountNumber);
    $last4 = substr($sanitized, -4);
    if ($last4 === false || $last4 === '') {
        $last4 = '0000';
    }

    return [
        'last4' => $last4,
        'masked' => str_repeat('*', max(strlen($sanitized) - 4, 0)) . $last4
    ];
}

function getWalletTransactionByOrderAndType($vendorId, $orderId, $type, $lockForUpdate = false) {
    global $pdo;

    $sql = "SELECT * FROM wallet_transactions WHERE vendor_id = ? AND order_id = ? AND type = ?";
    if ($lockForUpdate) {
        $sql .= " FOR UPDATE";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$vendorId, $orderId, $type]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function recordPendingWalletEarning($vendorId, $orderId, $grossAmount, $reference = null) {
    global $pdo;

    ensureVendorWallet($vendorId);

    $wallet = getVendorWallet($vendorId, true);
    $existing = getWalletTransactionByOrderAndType($vendorId, $orderId, 'earning', true);
    if ($existing) {
        return $existing;
    }

    $balanceBefore = floatval($wallet['pending_balance'] ?? 0);
    $balanceAfter = $balanceBefore + floatval($grossAmount);

    $safeReference = $reference ? ($reference . '-earn-' . $orderId) : ('earn-' . $orderId);

    $stmt = $pdo->prepare("\n        INSERT INTO wallet_transactions\n            (vendor_id, order_id, type, amount, balance_before, balance_after, status, reference)\n        VALUES (?, ?, 'earning', ?, ?, ?, 'pending', ?)\n    ");
    $stmt->execute([
        $vendorId,
        $orderId,
        $grossAmount,
        $balanceBefore,
        $balanceAfter,
        $safeReference
    ]);

    $stmt = $pdo->prepare("\n        UPDATE vendor_wallet\n        SET pending_balance = pending_balance + ?, total_earned = total_earned + ?, updated_at = NOW()\n        WHERE vendor_id = ?\n    ");
    $stmt->execute([$grossAmount, $grossAmount, $vendorId]);

    return $pdo->lastInsertId();
}

function releasePendingWalletEarning($vendorId, $orderId, $grossAmount, $commissionAmount = 0.00, $reference = null) {
    global $pdo;

    ensureVendorWallet($vendorId);

    $wallet = getVendorWallet($vendorId, true);
    $earning = getWalletTransactionByOrderAndType($vendorId, $orderId, 'earning', true);

    if (!$earning) {
        $availableBefore = floatval($wallet['available_balance'] ?? 0);
        $availableAfter = $availableBefore + floatval($grossAmount);

        $stmt = $pdo->prepare("\n            INSERT INTO wallet_transactions\n                (vendor_id, order_id, type, amount, balance_before, balance_after, status, reference)\n            VALUES (?, ?, 'earning', ?, ?, ?, 'available', ?)\n        ");
        $stmt->execute([
            $vendorId,
            $orderId,
            $grossAmount,
            $availableBefore,
            $availableAfter,
            $reference ? ($reference . '-earn-' . $orderId) : ('earn-' . $orderId)
        ]);

        $stmt = $pdo->prepare("\n            UPDATE vendor_wallet\n            SET available_balance = available_balance + ?, total_earned = total_earned + ?, updated_at = NOW()\n            WHERE vendor_id = ?\n        ");
        $stmt->execute([$grossAmount, $grossAmount, $vendorId]);

        $wallet = getVendorWallet($vendorId, true);
        $earning = getWalletTransactionByOrderAndType($vendorId, $orderId, 'earning', true);
    } elseif ($earning['status'] === 'pending') {
        $stmt = $pdo->prepare("\n            UPDATE vendor_wallet\n            SET pending_balance = GREATEST(pending_balance - ?, 0), available_balance = available_balance + ?, updated_at = NOW()\n            WHERE vendor_id = ?\n        ");
        $stmt->execute([$grossAmount, $grossAmount, $vendorId]);

        $stmt = $pdo->prepare("\n            UPDATE wallet_transactions\n            SET status = 'available', balance_after = ?, updated_at = NOW()\n            WHERE id = ?\n        ");
        $stmt->execute([
            floatval($wallet['available_balance'] ?? 0) + floatval($grossAmount),
            $earning['id']
        ]);
    }

    if (floatval($commissionAmount) > 0) {
        $existingCommission = getWalletTransactionByOrderAndType($vendorId, $orderId, 'commission', true);
        if (!$existingCommission) {
            $wallet = getVendorWallet($vendorId, true);
            $balanceBeforeCommission = floatval($wallet['available_balance'] ?? 0);
            $balanceAfterCommission = $balanceBeforeCommission - floatval($commissionAmount);

            $stmt = $pdo->prepare("\n                INSERT INTO wallet_transactions\n                    (vendor_id, order_id, type, amount, balance_before, balance_after, status, reference)\n                VALUES (?, ?, 'commission', ?, ?, ?, 'paid', ?)\n            ");
            $stmt->execute([
                $vendorId,
                $orderId,
                $commissionAmount,
                $balanceBeforeCommission,
                $balanceAfterCommission,
                $reference ? ($reference . '-commission-' . $orderId) : ('commission-' . $orderId)
            ]);

            $stmt = $pdo->prepare("\n                UPDATE vendor_wallet\n                SET available_balance = GREATEST(available_balance - ?, 0), updated_at = NOW()\n                WHERE vendor_id = ?\n            ");
            $stmt->execute([$commissionAmount, $vendorId]);
        }
    }

    return true;
}

function reverseWalletEarning($vendorId, $orderId) {
    global $pdo;

    ensureVendorWallet($vendorId);

    $earning = getWalletTransactionByOrderAndType($vendorId, $orderId, 'earning', true);
    $commission = getWalletTransactionByOrderAndType($vendorId, $orderId, 'commission', true);

    if (!$earning && !$commission) {
        return true;
    }

    $earningAmount = floatval($earning['amount'] ?? 0);
    $commissionAmount = floatval($commission['amount'] ?? 0);

    if ($earning && $earning['status'] === 'pending') {
        $stmt = $pdo->prepare("\n            UPDATE vendor_wallet\n            SET pending_balance = GREATEST(pending_balance - ?, 0),\n                total_earned = GREATEST(total_earned - ?, 0),\n                updated_at = NOW()\n            WHERE vendor_id = ?\n        ");
        $stmt->execute([$earningAmount, $earningAmount, $vendorId]);
    } elseif ($earning && $earning['status'] === 'available') {
        $stmt = $pdo->prepare("\n            UPDATE vendor_wallet\n            SET available_balance = GREATEST(available_balance - ?, 0),\n                total_earned = GREATEST(total_earned - ?, 0),\n                updated_at = NOW()\n            WHERE vendor_id = ?\n        ");
        $stmt->execute([$earningAmount, $earningAmount, $vendorId]);
    }

    if ($commissionAmount > 0) {
        $stmt = $pdo->prepare("\n            UPDATE vendor_wallet\n            SET available_balance = available_balance + ?, updated_at = NOW()\n            WHERE vendor_id = ?\n        ");
        $stmt->execute([$commissionAmount, $vendorId]);
    }

    if ($earning) {
        $stmt = $pdo->prepare("DELETE FROM wallet_transactions WHERE id = ?");
        $stmt->execute([$earning['id']]);
    }

    if ($commission) {
        $stmt = $pdo->prepare("DELETE FROM wallet_transactions WHERE id = ?");
        $stmt->execute([$commission['id']]);
    }

    return true;
}

function getWalletPeriodRange($periodType, $startDate = null, $endDate = null) {
    $today = new DateTime('now', new DateTimeZone('Africa/Nairobi'));

    if ($startDate && $endDate) {
        return [$startDate, $endDate];
    }

    switch ($periodType) {
        case 'daily':
            $start = clone $today;
            $start->setTime(0, 0, 0);
            $end = clone $today;
            $end->setTime(23, 59, 59);
            break;
        case 'weekly':
            $start = clone $today;
            $start->modify('monday this week')->setTime(0, 0, 0);
            $end = clone $start;
            $end->modify('+6 days')->setTime(23, 59, 59);
            break;
        case 'monthly':
            $start = clone $today;
            $start->modify('first day of this month')->setTime(0, 0, 0);
            $end = clone $start;
            $end->modify('last day of this month')->setTime(23, 59, 59);
            break;
        case 'yearly':
            $start = clone $today;
            $start->modify('first day of january ' . $today->format('Y'))->setTime(0, 0, 0);
            $end = clone $start;
            $end->modify('last day of december ' . $today->format('Y'))->setTime(23, 59, 59);
            break;
        default:
            $start = clone $today;
            $start->modify('-30 days')->setTime(0, 0, 0);
            $end = clone $today;
            $end->setTime(23, 59, 59);
            break;
    }

    return [$start->format('Y-m-d'), $end->format('Y-m-d')];
}

function getWalletReportByPeriod($periodType, $startDate = null, $endDate = null) {
    global $pdo;

    [$rangeStart, $rangeEnd] = getWalletPeriodRange($periodType, $startDate, $endDate);

    $stmt = $pdo->prepare("\n        SELECT
            v.id as vendor_id,
            v.farm_name,
            u.email,
            COALESCE(vpa.paystack_recipient_code, r.paystack_recipient_code) as paystack_recipient_code,
            vpa.method as payout_method,
            vpa.provider_name as payout_provider_name,
            vpa.account_last4 as payout_account_last4,
            CASE
                WHEN ve.total_earned IS NULL AND po.total_withdrawn IS NULL
                    THEN COALESCE(vw.available_balance, 0)
                ELSE GREATEST(COALESCE(ve.total_earned, 0) - COALESCE(po.total_withdrawn, 0), 0)
            END as available_balance,
            COALESCE(wp.pending_balance, COALESCE(vw.pending_balance, 0)) as pending_balance,
            COALESCE(ve.total_earned, COALESCE(vw.total_earned, 0)) as total_earned,
            COALESCE(po.total_withdrawn, COALESCE(vw.total_withdrawn, 0)) as total_withdrawn,
            COALESCE(pe.period_earnings_total, 0) as earnings_total,
            COALESCE(pc.period_commission_total, 0) as commission_total,
            COALESCE(pp.period_payout_total, 0) as payout_total
        FROM vendors v
        JOIN user_profiles u ON u.id = v.user_id
        LEFT JOIN vendor_wallet vw ON vw.vendor_id = v.id
        LEFT JOIN vendor_transfer_recipients r ON r.vendor_id = v.id
        LEFT JOIN (
            SELECT vpa1.vendor_id, vpa1.method, vpa1.provider_name, vpa1.account_last4, vpa1.paystack_recipient_code
            FROM vendor_payout_accounts vpa1
            INNER JOIN (
                SELECT vendor_id, MAX(id) as max_id
                FROM vendor_payout_accounts
                WHERE is_active = 1
                GROUP BY vendor_id
            ) vpa2 ON vpa2.max_id = vpa1.id
        ) vpa ON vpa.vendor_id = v.id
        LEFT JOIN (
            SELECT vendor_id, COALESCE(SUM(net_amount), 0) as total_earned
            FROM vendor_earnings
            WHERE status = 'confirmed'
            GROUP BY vendor_id
        ) ve ON ve.vendor_id = v.id
        LEFT JOIN (
            SELECT vendor_id, COALESCE(SUM(amount), 0) as total_withdrawn
            FROM payouts
            WHERE status = 'paid'
            GROUP BY vendor_id
        ) po ON po.vendor_id = v.id
        LEFT JOIN (
            SELECT vendor_id, COALESCE(SUM(amount), 0) as pending_balance
            FROM wallet_transactions
            WHERE type = 'earning' AND status = 'pending'
            GROUP BY vendor_id
        ) wp ON wp.vendor_id = v.id
        LEFT JOIN (
            SELECT vendor_id, COALESCE(SUM(net_amount), 0) as period_earnings_total
            FROM vendor_earnings
            WHERE status = 'confirmed'
              AND DATE(COALESCE(confirmed_at, created_at)) BETWEEN ? AND ?
            GROUP BY vendor_id
        ) pe ON pe.vendor_id = v.id
        LEFT JOIN (
            SELECT vendor_id, COALESCE(SUM(commission_amount), 0) as period_commission_total
            FROM platform_commissions
            WHERE status = 'processed'
              AND DATE(COALESCE(processed_at, created_at)) BETWEEN ? AND ?
            GROUP BY vendor_id
        ) pc ON pc.vendor_id = v.id
        LEFT JOIN (
            SELECT vendor_id, COALESCE(SUM(amount), 0) as period_payout_total
            FROM payouts
            WHERE status = 'paid'
              AND DATE(COALESCE(updated_at, created_at)) BETWEEN ? AND ?
            GROUP BY vendor_id
        ) pp ON pp.vendor_id = v.id
        ORDER BY available_balance DESC, earnings_total DESC
    ");
    $stmt->execute([$rangeStart, $rangeEnd, $rangeStart, $rangeEnd, $rangeStart, $rangeEnd]);
    $vendors = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt = $pdo->prepare("\n        SELECT
            COALESCE((
                SELECT SUM(ve.net_amount)
                FROM vendor_earnings ve
                WHERE ve.status = 'confirmed'
                  AND DATE(COALESCE(ve.confirmed_at, ve.created_at)) BETWEEN ? AND ?
            ), 0) as earnings_total,
            COALESCE((
                SELECT SUM(pc.commission_amount)
                FROM platform_commissions pc
                WHERE pc.status = 'processed'
                  AND DATE(COALESCE(pc.processed_at, pc.created_at)) BETWEEN ? AND ?
            ), 0) as commission_total,
            COALESCE((
                SELECT SUM(p.amount)
                FROM payouts p
                WHERE p.status = 'paid'
                  AND DATE(COALESCE(p.updated_at, p.created_at)) BETWEEN ? AND ?
            ), 0) as payout_total
    ");
    $stmt->execute([$rangeStart, $rangeEnd, $rangeStart, $rangeEnd, $rangeStart, $rangeEnd]);
    $totals = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    return [
        'period_type' => $periodType,
        'start_date' => $rangeStart,
        'end_date' => $rangeEnd,
        'totals' => [
            'earnings_total' => floatval($totals['earnings_total'] ?? 0),
            'commission_total' => floatval($totals['commission_total'] ?? 0),
            'payout_total' => floatval($totals['payout_total'] ?? 0)
        ],
        'vendors' => array_map(function ($row) {
            return [
                'vendor_id' => $row['vendor_id'],
                'farm_name' => $row['farm_name'],
                'email' => $row['email'],
                'paystack_recipient_code' => $row['paystack_recipient_code'],
                'payout_method' => $row['payout_method'],
                'payout_provider_name' => $row['payout_provider_name'],
                'payout_account_last4' => $row['payout_account_last4'],
                'available_balance' => floatval($row['available_balance']),
                'pending_balance' => floatval($row['pending_balance']),
                'total_earned' => floatval($row['total_earned']),
                'total_withdrawn' => floatval($row['total_withdrawn']),
                'earnings_total' => floatval($row['earnings_total']),
                'commission_total' => floatval($row['commission_total']),
                'payout_total' => floatval($row['payout_total'])
            ];
        }, $vendors)
    ];
}

function createPaystackTransfer($amount, $recipientCode, $reference, $reason = '') {
    $payload = [
        'source' => 'balance',
        'amount' => formatPaystackTransferAmount($amount),
        'recipient' => $recipientCode,
        'reference' => $reference,
        'reason' => $reason ?: 'Vendor payout'
    ];

    return sendPaystackJsonRequest(PAYSTACK_INITIATE_TRANSFER, $payload);
}

?>