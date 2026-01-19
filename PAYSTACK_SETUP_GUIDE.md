# Paystack Payment Gateway Setup Guide

## 🚀 Quick Start

This guide will help you set up Paystack payment integration for your Poultry Hub Kenya platform.

## 📋 Prerequisites

- Paystack account (sign up at [paystack.com](https://paystack.com))
- PHP 7.4+ with Composer
- MySQL database
- Node.js and npm

## ⚙️ Step 1: Paystack Account Setup

### 1.1 Create Paystack Account
1. Visit [paystack.com](https://paystack.com) and sign up
2. Complete business verification
3. Get your API keys from the dashboard

### 1.2 Get API Keys
- **Test Keys**: For development/testing
- **Live Keys**: For production (after verification)

## 🔧 Step 2: Environment Configuration

### 2.1 Update Environment Variables

Add these to your `.env` file in the root directory:

```env
# Paystack Configuration
PAYSTACK_PUBLIC_KEY=pk_test_your_public_key_here
PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret_here
```

For production, replace with live keys:
```env
PAYSTACK_PUBLIC_KEY=pk_live_your_live_public_key
PAYSTACK_SECRET_KEY=sk_live_your_live_secret_key
PAYSTACK_WEBHOOK_SECRET=your_live_webhook_secret
```

### 2.2 Backend Environment Variables

Add to `backend/.env`:
```env
# Paystack (same as root .env)
PAYSTACK_PUBLIC_KEY=pk_test_your_public_key_here
PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret_here
```

## 📦 Step 3: Install Dependencies

### 3.1 Install PHP Dependencies
```bash
cd backend
composer install
```

This will install the Paystack PHP SDK and other dependencies.

### 3.2 Install Frontend Dependencies
```bash
npm install
```

## 🗄️ Step 4: Database Setup

### 4.1 Run Migration
```bash
cd backend
php migrations/add_paystack_payment_tables.php
```

This creates:
- `payment_transactions` table
- `payment_webhooks` table
- Adds payment fields to `orders` table

### 4.2 Verify Tables
Check your database to ensure these tables exist:
- `payment_transactions`
- `payment_webhooks`
- `orders` (with new payment columns)

## 🌐 Step 5: Webhook Configuration

### 5.1 Set Up Webhook URL
1. Go to your Paystack dashboard
2. Navigate to Settings → Webhooks
3. Add webhook URL: `https://yourdomain.com/api/payments/paystack/webhook`
4. Select events:
   - `charge.success`
   - `charge.failed`
   - `transfer.success` (if using transfers)

### 5.2 Webhook Secret
- Copy the webhook secret from Paystack dashboard
- Add it to your `.env` as `PAYSTACK_WEBHOOK_SECRET`

## 🧪 Step 6: Testing

### 6.1 Localhost Limitations
⚠️ **Important**: Paystack payment integration has limitations when testing on localhost:

- **Paystack option is disabled** on localhost/127.0.0.1 for security reasons
- **Webhooks won't work** on localhost (requires HTTPS public URL)
- **For local testing**, use M-Pesa option or deploy to a staging server

### 6.2 Test Mode Setup
Use test keys for development:
- Public Key: `pk_test_*`
- Secret Key: `sk_test_*`

### 6.3 Testing on Localhost
Since Paystack is disabled on localhost, you can:

1. **Test M-Pesa flow** (works on localhost)
2. **Deploy to staging server** for full Paystack testing
3. **Use ngrok** or similar tool to expose localhost with HTTPS

### 6.4 Production Testing
Once deployed to a server with HTTPS:

#### Test Cards
Use these test card details:

**✅ Successful Payment:**
- Card Number: `4084084084084081`
- Expiry: `12/25`
- CVV: `408`

**❌ Insufficient Funds:**
- Card Number: `4084084084084082`
- Expiry: `12/25`
- CVV: `408`

**❌ Declined Card:**
- Card Number: `4084084084084083`
- Expiry: `12/25`
- CVV: `408`

#### Test Payment Flow
1. Add items to cart
2. Go to checkout
3. Select "Paystack" payment method (now enabled)
4. Complete payment with test card
5. Verify order status updates
6. Check email notifications
7. Test webhook handling

## 🚀 Step 7: Going Live

### 7.1 Switch to Live Keys
Replace test keys with live keys in your `.env` files.

### 7.2 Update Webhook URL
Change webhook URL to your production domain.

### 7.3 Test Live Payments
- Start with small amounts
- Test all payment methods
- Monitor webhook logs

## 🔧 Troubleshooting

### Common Issues

**1. "Invalid API key" error**
- Check that your keys are correct
- Ensure you're using test keys for test mode

**2. Webhook not receiving events**
- Verify webhook URL is accessible
- Check webhook secret matches
- Ensure HTTPS is enabled

**3. Payment verification fails**
- Check API keys are correct
- Verify transaction reference format
- Check network connectivity

### Debug Commands

```bash
# Check PHP dependencies
cd backend && composer show

# Test database connection
cd backend && php -r "require 'config/database.php'; echo 'DB connected';"

# Check migration status
cd backend && php migrations/add_paystack_payment_tables.php
```

## 📞 Support

- **Paystack Documentation**: [docs.paystack.com](https://docs.paystack.com)
- **Paystack Support**: support@paystack.com
- **Platform Issues**: Check application logs and database

## ✅ Checklist

- [ ] Paystack account created
- [ ] API keys configured
- [ ] Environment variables set
- [ ] Dependencies installed
- [ ] Database migrated
- [ ] Webhooks configured
- [ ] Test payments working
- [ ] Live keys deployed (production only)

---

**🎉 Your Paystack integration is now ready!**
