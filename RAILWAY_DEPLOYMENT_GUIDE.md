# Railway Deployment Guide - Poultry Hub Kenya

## 🚀 Complete Deployment to Railway (Free Tier)

This guide will deploy your full-stack Poultry Hub Kenya application to Railway for free.

## 📋 Prerequisites

1. **GitHub Account** - Push your code to GitHub
2. **Railway Account** - Sign up at [railway.app](https://railway.app)
3. **Paystack Test Keys** - For payment processing
4. **Google/Gemini API Keys** - For AI features

---

## 🛠️ Step 1: Prepare Your Code

### 1.1 Build and Test Locally
```bash
# Build frontend
npm run build

# Test production build
npm run preview
```

### 1.2 Commit All Changes
```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

---

## 🌐 Step 2: Deploy to Railway

### 2.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (recommended)
3. Verify your email

### 2.2 Create New Project
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your `poultry-hub-kenya` repository
4. Click **"Deploy Now"**

### 2.3 Configure Services

Railway will automatically detect your services. Configure them as follows:

#### **Frontend Service**
- **Name**: `frontend`
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Port**: `8080`

#### **Backend Service**
- **Name**: `backend`
- **Root Directory**: `./backend`
- **Build Command**: `composer install`
- **Start Command**: `php -S 0.0.0.0:$PORT`
- **Port**: `8080`

#### **Database Service**
- **Name**: `database`
- **Type**: `MySQL`
- **Version**: `8.0`

---

## ⚙️ Step 3: Configure Environment Variables

In your Railway project, go to **Settings** → **Variables** and add these:

### **Database Variables** (Railway provides automatically)
```
DATABASE_URL=mysql://${DATABASE_USER}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT}/${DATABASE_NAME}
```

### **Application Variables**
```
# JWT
JWT_SECRET_KEY=your-super-secret-jwt-key-here

# API Keys
GEMINI_API_KEY=your-gemini-api-key
OPENROUTER_API_KEY=your-openrouter-api-key

# Paystack (Test Mode)
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_ENCRYPTION=ssl
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=Poultry Hub Kenya
ADMIN_EMAIL=your-email@gmail.com

# SMS (Optional)
SMS_ENABLED=false
SMS_PROVIDER=africas_talking
AFRICASTALKING_USERNAME=your-username
AFRICASTALKING_API_KEY=your-api-key
AFRICASTALKING_SENDER_ID=2391

# Security
RATE_LIMIT_ENABLED=true
MAX_LOGIN_ATTEMPTS=5
LOGIN_TIMEOUT_MINUTES=5

# File Upload
MAX_FILE_SIZE_MB=5
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,webp

# Railway Specific
NODE_ENV=production
PHP_ENV=production
RAILWAY_ENVIRONMENT=production
```

---

## 🗄️ Step 4: Database Setup

### 4.1 Get Database Credentials
1. Go to your `database` service in Railway
2. Click **"Connect"** → **"PHP"**
3. Copy the connection string

### 4.2 Import Your Local Database
```bash
# Export your local database
mysqldump -u root -p "poultry marketplace" > local_database.sql

# Import to Railway (use the connection string from Railway)
mysql -h host -u user -p database_name < local_database.sql
```

### 4.3 Update Database Tables for Railway
Run this SQL to update file paths for production:

```sql
-- Update image URLs for Railway domain
UPDATE products SET 
  image_urls = REPLACE(image_urls, 'http://localhost/poultry-hub-kenya/', 'https://your-frontend-url.railway.app/');

UPDATE user_profiles SET 
  profile_image = REPLACE(profile_image, 'http://localhost/poultry-hub-kenya/', 'https://your-frontend-url.railway.app/');
```

---

## 🌐 Step 5: Configure Domains & URLs

### 5.1 Get Your Railway URLs
- **Frontend**: `https://your-app-name.railway.app`
- **Backend**: `https://your-backend-name.railway.app`
- **Database**: Internal (not public)

### 5.2 Update Paystack Webhooks
1. Go to [Paystack Dashboard](https://dashboard.paystack.co/)
2. **Settings** → **API Keys & Webhooks**
3. Add webhook URL: `https://your-backend-name.railway.app/api/payments/paystack/webhook`

---

## 🔄 Step 6: Test Your Deployment

### 6.1 Check Frontend
- Visit: `https://your-app-name.railway.app`
- Should load the React app

### 6.2 Check Backend API
- Visit: `https://your-backend-name.railway.app/api`
- Should return: `{"message":"KukuSoko API is running","status":"success"}`

### 6.3 Test Key Features
- ✅ User registration/login
- ✅ Product browsing
- ✅ Cart functionality
- ✅ Checkout process
- ✅ Paystack payment (test mode)

---

## 🛠️ Step 7: Troubleshooting

### **Common Issues & Solutions**

#### **Frontend Not Loading**
```bash
# Check build logs in Railway
# Ensure build command is: npm run build
# Ensure start command is: npm start
```

#### **Backend API Not Working**
```bash
# Check PHP errors in logs
# Ensure composer install ran
# Check database connection
```

#### **Database Connection Issues**
```bash
# Verify DATABASE_URL format
# Check database service is running
# Test connection manually
```

#### **Paystack Webhook Issues**
```bash
# Verify webhook URL is accessible
# Check webhook secret matches
# Test webhook in Paystack dashboard
```

#### **Image Upload Issues**
```bash
# Check uploads directory permissions
# Verify file size limits
# Check storage configuration
```

---

## 📊 Step 8: Monitor & Scale

### **Free Tier Limits**
- **$5 credit/month** (usually enough)
- **500 hours compute**
- **100GB bandwidth**
- **Shared MySQL database**

### **When to Upgrade**
- High traffic (1000+ daily users)
- Large database (>1GB)
- Need dedicated resources

### **Monitoring**
- Railway provides built-in metrics
- Check logs in dashboard
- Monitor usage in billing section

---

## 🎯 Step 9: Go Live!

### **Production Checklist**
- [ ] All environment variables set
- [ ] Database imported and configured
- [ ] Paystack webhooks configured
- [ ] SSL certificates (automatic)
- [ ] Custom domain (optional)
- [ ] Test all features
- [ ] Monitor performance

### **Custom Domain (Optional)**
1. Go to **Settings** → **Custom Domains**
2. Add your domain: `poultryhubkenya.com`
3. Update DNS records
4. SSL certificate auto-generated

---

## 🆘 Support & Help

### **Railway Documentation**
- [Getting Started](https://docs.railway.app/)
- [Environment Variables](https://docs.railway.app/deploy/environment-variables)
- [Databases](https://docs.railway.app/deploy/databases)

### **Common Debugging Commands**
```bash
# Check Railway CLI
npm install -g @railway/cli
railway login
railway status
railway logs

# Test locally with Railway env
railway variables
```

---

## 🎉 Congratulations!

Your Poultry Hub Kenya is now live on Railway! 🚀

### **What You Have**
- ✅ **Frontend**: React app on Railway
- ✅ **Backend**: PHP API on Railway  
- ✅ **Database**: MySQL on Railway
- ✅ **Payments**: Paystack integration
- ✅ **AI Features**: Gemini & OpenRouter
- ✅ **Free Hosting**: On Railway's free tier

### **Next Steps**
1. **Monitor performance** in Railway dashboard
2. **Set up monitoring** alerts
3. **Test thoroughly** with real users
4. **Scale up** when needed
5. **Add custom domain** for branding

**Your app is now accessible at: `https://your-app-name.railway.app`** 🎊
