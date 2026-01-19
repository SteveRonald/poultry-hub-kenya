# 🔧 Railway 502 Error Troubleshooting Guide

## 🚨 **502 Error: Application Failed to Respond**

This means your service deployed but the application crashed or failed to start.

---

## 🔍 **Step 1: Check Railway Logs**

### **How to Find Logs:**
1. Go to your Railway project
2. Click on the **frontend service**
3. Go to **"Logs"** tab
4. Look for error messages

### **Common 502 Causes:**
- ❌ **Build succeeded but app crashed on startup**
- ❌ **Missing environment variables**
- ❌ **Port configuration issues**
- ❌ **Database connection failures**
- ❌ **Missing dependencies**

---

## 🛠️ **Step 2: Common Fixes**

### **Fix 1: Port Configuration**
Your app might be trying to use wrong port:

**Frontend Issue:**
```javascript
// Check if vite.config.ts has correct port
export default defineConfig({
  server: {
    port: 8080, // Railway provides PORT env var
  }
})
```

**Backend Issue:**
```php
// Backend should use Railway's PORT
php -S 0.0.0.0:$PORT
```

### **Fix 2: Missing Environment Variables**
Check Railway **Settings** → **Variables**:

**Required for Frontend:**
```
VITE_API_URL=https://your-backend-name.railway.app
NODE_ENV=production
```

**Required for Backend:**
```
DATABASE_URL=mysql://user:pass@host:port/dbname
JWT_SECRET_KEY=your-jwt-secret
PAYSTACK_PUBLIC_KEY=pk_test_xxx
PAYSTACK_SECRET_KEY=sk_test_xxx
```

### **Fix 3: Database Connection**
Backend might not connect to database:

```php
// Check if DATABASE_URL is being used correctly
$database_url = getenv('DATABASE_URL');
if (!$database_url) {
    error_log("DATABASE_URL not set");
    die("Database connection failed");
}
```

### **Fix 4: Start Command Issues**
Verify start commands in Railway:

**Frontend:**
```
npm start
# OR
npx serve -s dist -l 8080
```

**Backend:**
```
php -S 0.0.0.0:$PORT
# OR
composer run start
```

---

## 🔧 **Step 3: Debug Your Specific Issue**

### **Check These Files:**

1. **package.json scripts:**
```json
{
  "scripts": {
    "start": "serve -s dist -l 8080"
  }
}
```

2. **vite.config.ts:**
```typescript
export default defineConfig({
  server: {
    host: true,
    port: 8080
  }
})
```

3. **Backend index.php:**
```php
// Check if it's listening on correct port
$port = getenv('PORT') ?: 8080;
```

---

## 🚀 **Step 4: Quick Fixes to Try**

### **Fix A: Update Start Command**
In Railway service settings, change start command to:
```
npx serve -s dist -l 8080
```

### **Fix B: Add Environment Variables**
Add these to Railway variables:
```
NODE_ENV=production
PORT=8080
```

### **Fix C: Check Dependencies**
Ensure `serve` is installed:
```bash
npm install serve --save-dev
```

---

## 📋 **Step 5: Redeploy After Fixes**

1. **Apply fixes** to your code
2. **Commit and push** to GitHub
3. **Redeploy** on Railway
4. **Check logs** again

---

## 🆘 **If Still Failing:**

### **Share Your Logs:**
Copy the error messages from Railway logs and share them for specific help.

### **Common Log Errors:**
- `Error: Cannot find module 'serve'` → Install serve package
- `Database connection failed` → Check DATABASE_URL
- `Port already in use` → Change port configuration
- `Permission denied` → Check file permissions

---

## 🎯 **Most Likely Fix:**

Based on your setup, the issue is probably:

1. **Missing `serve` package** in production
2. **Wrong start command** for Railway
3. **Missing environment variables**

**Try this first:**
```bash
# Locally test
npm install serve
npm run build
npx serve -s dist -l 8080
```

If this works locally, update Railway start command to: `npx serve -s dist -l 8080`

---

## 📞 **Next Steps:**

1. **Check your Railway logs** now
2. **Look for specific error messages**
3. **Apply the relevant fix** from above
4. **Redeploy and test**

**What error do you see in the Railway logs?** 📋
