# Paystack Localhost Development Setup Guide

## Overview
This guide helps you configure Paystack payment integration for local development on localhost.

## Prerequisites
- Paystack account (sign up at [paystack.co](https://paystack.co))
- Test mode API keys from Paystack dashboard

## Step 1: Get Paystack Test Keys

1. Login to your [Paystack Dashboard](https://dashboard.paystack.co/)
2. Go to **Settings** → **API Keys & Webhooks**
3. Copy your **Test Public Key** and **Test Secret Key**
4. Generate a webhook secret or copy the existing one

## Step 2: Update Environment Variables

Edit your `backend/.env` file and update the following:

```env
# Paystack Configuration
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret_here

# Application URLs for localhost development
APP_URL=http://localhost:5173
PAYSTACK_WEBHOOK_URL=http://localhost:5173/api/payments/paystack/webhook
```

Replace with your actual test keys from Paystack.

## Step 3: Configure Webhook in Paystack Dashboard

1. In Paystack Dashboard, go to **Settings** → **API Keys & Webhooks**
2. Add a new webhook URL: `http://localhost:5173/api/payments/paystack/webhook`
3. Set the webhook secret to match what you put in `.env`
4. **Important**: For localhost testing, you'll need to use a tunneling service

## Step 4: Set Up Localhost Tunneling (Required for Webhooks)

Paystack webhooks require a publicly accessible URL. Use one of these options:

### Option A: Using ngrok (Recommended)
```bash
# Install ngrok
npm install -g ngrok

# Start ngrok for your frontend port
ngrok http 5173

# Copy the https URL from ngrok output
# Example: https://abc123.ngrok.io
```

### Option B: Using localtunnel
```bash
# Install localtunnel
npm install -g localtunnel

# Start tunnel
lt --port 5173

# Copy the URL from output
```

### Option C: Using Paystack's Test Webhook
For testing, you can use Paystack's built-in webhook testing in the dashboard.

## Step 5: Update Webhook URL with Tunnel

Once you have your tunnel URL, update the webhook in Paystack Dashboard:

```
https://your-tunnel-url.ngrok.io/api/payments/paystack/webhook
```

And update your `.env`:
```env
PAYSTACK_WEBHOOK_URL=https://your-tunnel-url.ngrok.io/api/payments/paystack/webhook
```

## Step 6: Test the Integration

1. Start your development servers:
   ```bash
   # Frontend (in project root)
   npm run dev
   
   # Backend should be running via XAMPP
   # Backend API: http://localhost/poultry-hub-kenya/backend/
   ```

2. Test the payment flow:
   - Add items to cart
   - Proceed to checkout
   - Select "Paystack" as payment method
   - Fill in delivery details
   - Click "Proceed to Payment"
   - Paystack popup should appear
   - Use Paystack test cards for payment

## Paystack Test Cards

Use these test cards in the Paystack popup:

### Successful Payment
- **Card Number**: `5060690000000000006`
- **CVV**: Any 3 digits
- **Expiry**: Any future date
- **PIN**: `1234` (if required)
- **OTP**: `123456`

### Failed Payment
- **Card Number**: `5060690000000000014`
- **CVV**: Any 3 digits
- **Expiry**: Any future date

## Step 7: Webhook Testing

To test webhooks locally:

1. In Paystack Dashboard, go to **Webhooks**
2. Find your webhook endpoint
3. Click "Test" to send test events
4. Check your backend logs for webhook processing

## Common Issues & Solutions

### Issue: "Paystack requires HTTPS"
- **Solution**: Use the tunnel URL (https) for webhooks, but localhost (http) works for the popup

### Issue: Webhook not received
- **Solution**: 
  - Ensure your tunnel is running
  - Check webhook URL in Paystack dashboard
  - Verify webhook secret matches

### Issue: CORS errors
- **Solution**: The backend CORS is already configured for localhost ports

### Issue: Invalid signature
- **Solution**: Ensure webhook secret matches exactly in both Paystack dashboard and `.env`

## Production Deployment

For production:
1. Switch to live Paystack keys
2. Update webhook URL to your production domain
3. Ensure HTTPS is enabled
4. Test thoroughly before going live

## API Endpoints

The integration uses these endpoints:

- `POST /api/payments/paystack/initialize` - Initialize payment
- `GET /api/payments/paystack/verify/{reference}` - Verify payment
- `POST /api/payments/paystack/webhook` - Webhook handler

## Security Notes

- Never expose your secret key in frontend code
- Always verify webhook signatures
- Use HTTPS in production
- Implement proper error handling

## Support

If you encounter issues:
1. Check browser console for JavaScript errors
2. Check backend logs (`backend/logs/`)
3. Verify Paystack dashboard webhook status
4. Ensure all environment variables are set correctly
