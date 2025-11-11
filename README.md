# 🐔 Poultry Hub Kenya

> **Kenya's Premier Poultry Marketplace** - Connecting farmers, vendors, and customers across Kenya

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PHP](https://img.shields.io/badge/PHP-7.4%2B-blue.svg)](https://www.php.net/)
[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-5.7%2B-orange.svg)](https://www.mysql.com/)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

**Poultry Hub Kenya** is a comprehensive e-commerce platform designed specifically for the Kenyan poultry market. It connects poultry farmers, vendors, and customers in a trusted marketplace where users can buy and sell poultry products including chicks, eggs, poultry meat, feed, equipment, and medicine.

### Key Objectives

- **Connect Farmers & Customers**: Bridge the gap between poultry farmers and customers across Kenya
- **Quality Assurance**: AI-powered product verification and quality assessment
- **Market Insights**: Real-time market prices and AI-predicted price trends
- **Trusted Marketplace**: Verified vendors and secure transaction platform
- **Localized Experience**: Support for English and Kiswahili languages

### Target Users

- **Customers**: Individuals and businesses looking to purchase poultry products
- **Vendors**: Poultry farmers and suppliers who want to sell their products
- **Admins**: Platform administrators managing the marketplace

---

## ✨ Features

### 🛍️ Core Marketplace Features

- **Product Listings**: Browse and search poultry products by category, location, and vendor
- **Shopping Cart**: Add products to cart and checkout securely
- **Order Management**: Track orders from placement to delivery
- **Vendor Profiles**: Verified vendor profiles with farm information and location
- **Product Categories**: 
  - Chicks (day-old, week-old, etc.)
  - Eggs
  - Poultry Meat
  - Feed
  - Equipment
  - Medicine

### 🤖 AI-Powered Features

- **Image Verification**: AI-powered product image analysis using Google Gemini
- **Automatic Description Generation**: AI-generated product descriptions
- **Hybrid Chatbot**: 
  - Website-specific questions (local logic)
  - General poultry farming advice (OpenRouter AI)
  - Support for English and Kiswahili
  - Conversation history and multi-conversation management

### 📊 Market Insights

- **Real-Time Prices**: Current market prices from KAMIS and vendor platform data
- **Price Predictions**: AI-powered price forecasting using Prophet and ARIMA models
- **Price Trends**: Interactive charts showing historical and predicted prices
- **County-Level Data**: Filter prices by county and product type
- **Time Period Aggregation**: View prices by daily, weekly, monthly, or yearly periods

### 📢 Advertisement System

- **Product Advertisements**: Vendors can promote their products
- **Advertisement Tiers**: Basic and Premium advertisement options
- **Analytics**: Track advertisement views, clicks, and revenue
- **Targeted Display**: Display advertisements on specific pages

### 💬 Chat System

- **Multi-Language Support**: English and Kiswahili
- **Conversation Management**: Multiple conversations per user
- **Quick Replies**: Pre-defined quick reply buttons
- **FAQ Cache**: Cached responses for faster performance
- **Machine Learning**: Learning from user feedback and patterns

### 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Customer, Vendor, and Admin roles
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection Protection**: Prepared statements for all queries
- **XSS Protection**: Content sanitization and secure storage
- **Rate Limiting**: API rate limiting to prevent abuse
- **Security Logging**: Comprehensive security event logging

### 📍 Location Management

- **Kenya Administrative Units**: Counties, Constituencies, and Wards
- **Location-Based Filtering**: Filter products and vendors by location
- **Vendor Location**: Vendors can specify their exact location

### 💰 Financial Management

- **Platform Commissions**: Automatic commission calculation (10% from delivered orders)
- **Vendor Earnings**: Track vendor earnings and payments
- **Payment Methods**: M-Pesa, Bank, PayPal support
- **Order Tracking**: Track payment status and order status

### 📱 Notifications

- **Email Notifications**: Automated email notifications for orders and updates
- **SMS Notifications**: SMS notifications for important events
- **In-App Notifications**: Real-time in-app notifications

### 🔄 Backup & Recovery

- **Automated Backups**: Scheduled database backups
- **Google Drive Integration**: Backup storage on Google Drive
- **Backup Management**: Admin interface for backup management

---

## 🛠️ Technology Stack

### Frontend

- **React 18.3**: Modern UI library
- **TypeScript 5.5**: Type-safe JavaScript
- **Vite 5.4**: Fast build tool and dev server
- **Tailwind CSS 3.4**: Utility-first CSS framework
- **Radix UI**: Accessible UI components
- **Recharts 2.15**: Interactive charts for market insights
- **React Router 6.26**: Client-side routing
- **React Hook Form 7.53**: Form management
- **Zod 3.23**: Schema validation
- **Sonner 1.7**: Toast notifications

### Backend

- **PHP 7.4+**: Server-side scripting
- **MySQL 5.7+**: Relational database
- **PDO**: Database abstraction layer
- **Composer**: PHP dependency management
- **PHPMailer 6.8**: Email sending

### AI & Machine Learning

- **Google Gemini 2.5 Flash**: Image analysis and description generation
- **OpenRouter API**: General AI chat (DeepSeek, Mistral)
- **Python 3.8+**: Machine learning scripts
- **Prophet**: Time series forecasting
- **ARIMA**: Statistical forecasting model
- **Pandas**: Data manipulation
- **NumPy**: Numerical computing

### Data Sources

- **KAMIS**: Kenya Agricultural Market Information System (scraping)
- **Vendor Platform**: Aggregated vendor pricing data

### Infrastructure

- **XAMPP**: Local development environment
- **Apache**: Web server
- **MySQL**: Database server
- **cURL**: HTTP requests
- **Cron Jobs**: Scheduled tasks

### Development Tools

- **ESLint**: Code linting
- **TypeScript**: Type checking
- **Git**: Version control
- **PowerShell**: Script automation (Windows)

---

## 📁 Project Structure

```
poultry-hub-kenya/
├── backend/                 # PHP Backend API
│   ├── config/             # Configuration files
│   │   ├── database.php    # Database configuration
│   │   ├── ai_config.php   # AI service configuration
│   │   ├── email_config.php # Email configuration
│   │   └── env_loader.php  # Environment variable loader
│   ├── routes/             # API route handlers
│   │   ├── users.php       # User authentication
│   │   ├── products.php    # Product management
│   │   ├── orders.php      # Order management
│   │   ├── vendors.php     # Vendor management
│   │   ├── chat.php        # Chatbot API
│   │   ├── market_insights.php # Market insights API
│   │   └── ...
│   ├── services/           # Service classes
│   │   ├── ai/            # AI service integrations
│   │   └── sms/           # SMS service
│   ├── utils/             # Utility functions
│   │   ├── auth.php       # Authentication utilities
│   │   ├── security.php   # Security utilities
│   │   └── ...
│   ├── scripts/           # Utility scripts
│   │   ├── predict_prices.py # Price prediction script
│   │   ├── scrape_kamis_prices.php # KAMIS scraper
│   │   └── aggregate_vendor_prices.php # Vendor price aggregator
│   ├── cron/              # Cron job scripts
│   ├── migrations/        # Database migrations
│   └── vendor/            # Composer dependencies
├── src/                   # React Frontend
│   ├── components/        # React components
│   │   ├── ui/           # UI components
│   │   ├── Chatbot.tsx   # Chatbot component
│   │   ├── Navbar.tsx    # Navigation bar
│   │   └── ...
│   ├── pages/            # Page components
│   │   ├── Dashboard.tsx # User dashboard
│   │   ├── VendorDashboard.tsx # Vendor dashboard
│   │   ├── AdminDashboard.tsx # Admin dashboard
│   │   ├── MarketInsights.tsx # Market insights page
│   │   └── ...
│   ├── contexts/         # React contexts
│   ├── hooks/            # Custom React hooks
│   ├── config/           # Configuration
│   └── utils/            # Utility functions
├── public/               # Static assets
├── uploads/              # User uploads
├── backups/              # Database backups
├── package.json          # Node.js dependencies
├── composer.json         # PHP dependencies
├── vite.config.ts        # Vite configuration
├── tailwind.config.ts    # Tailwind configuration
└── README.md             # This file
```

---

## 🚀 Installation

### Prerequisites

- **PHP 7.4+** with extensions: `pdo`, `pdo_mysql`, `curl`, `json`
- **MySQL 5.7+** or **MariaDB 10.3+**
- **Node.js 18+** and **npm** or **yarn**
- **Python 3.8+** with pip
- **Composer** (PHP package manager)
- **XAMPP** (for local development) or **Apache** + **PHP** + **MySQL**

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/poultry-hub-kenya.git
cd poultry-hub-kenya
```

### Step 2: Install Backend Dependencies

```bash
cd backend
composer install
```

### Step 3: Install Frontend Dependencies

```bash
npm install
```

### Step 4: Install Python Dependencies

```bash
pip install mysql-connector-python pandas prophet statsmodels numpy
```

### Step 5: Database Setup

1. Create a MySQL database:
```sql
CREATE DATABASE `poultry marketplace` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Import the database schema (if you have a SQL file):
```bash
mysql -u root -p `poultry marketplace` < database.sql
```

3. Or run migrations manually (check `backend/migrations/` folder)

### Step 6: Environment Configuration

1. Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```

2. Copy `backend/.env.example` to `backend/.env`:
```bash
cp backend/.env.example backend/.env
```

3. Update `.env` files with your configuration:
```env
# Database Configuration
DB_HOST=localhost
DB_NAME=poultry marketplace
DB_USER=root
DB_PASSWORD=your_password

# AI API Keys
GEMINI_API_KEY=your_gemini_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_email_password

# App Configuration
APP_ENV=development
APP_URL=http://localhost/poultry-hub-kenya
```

### Step 7: Configure Apache (XAMPP)

1. Ensure XAMPP is installed and running
2. Place the project in `C:\xampp\htdocs\poultry-hub-kenya\` (Windows) or `/opt/lampp/htdocs/poultry-hub-kenya/` (Linux)
3. Access the backend API at: `http://localhost/poultry-hub-kenya/backend/`

### Step 8: Start Development Server

```bash
# Start frontend dev server
npm run dev

# The frontend will run on http://localhost:8080
# The backend API should be accessible at http://localhost/poultry-hub-kenya/backend/
```

---

## ⚙️ Configuration

### Database Configuration

Edit `backend/config/database.php` or use environment variables:

```php
DB_HOST=localhost
DB_NAME=poultry marketplace
DB_USER=root
DB_PASSWORD=your_password
```

### AI Services Configuration

Edit `backend/config/ai_config.php`:

- **Gemini API**: For image analysis and description generation
- **OpenRouter API**: For general AI chat

### Email Configuration

Edit `backend/config/email_config.php`:

- SMTP settings for email notifications
- Email templates in `backend/config/email_templates.php`

### SMS Configuration

Edit `backend/config/sms_config.php`:

- Africa's Talking API configuration
- SMS templates in `backend/routes/sms.php`

### Cron Jobs Setup

Set up the following cron jobs for automated tasks:

```bash
# Fetch market prices (monthly)
0 0 1 * * php /path/to/backend/cron/fetch_market_prices.php

# Generate price predictions (daily)
0 2 * * * php /path/to/backend/cron/generate_predictions.php

# Expire advertisements (daily)
0 0 * * * php /path/to/backend/cron/expire_advertisements.php

# Scheduled backups (daily)
0 3 * * * php /path/to/backend/cron/scheduled_backup.php
```

**Windows Task Scheduler:**

Use the provided batch files:
- `setup_windows_backup_task.bat` - Setup backup task
- `setup_dynamic_backup_task.bat` - Setup dynamic backup task

---

## 🗄️ Database Schema

The database consists of **38 tables** organized into the following categories:

### Core Tables

- **user_profiles**: User accounts (customers, vendors, admins)
- **vendors**: Vendor profiles and farm information
- **products**: Product listings
- **orders**: Customer orders
- **cart**: Shopping cart items

### Location Tables

- **counties**: Kenya counties
- **constituencies**: Kenya constituencies
- **wards**: Kenya wards

### Chat System Tables

- **chat_conversations**: Chat conversation sessions
- **chat_messages**: Chat messages
- **chat_intents**: Chatbot intent definitions
- **chat_quick_replies**: Quick reply buttons
- **chatbot_faq_cache**: Cached FAQ responses
- **chatbot_feedback**: User feedback
- **chatbot_learned_patterns**: ML learned patterns
- **chatbot_learned_synonyms**: ML learned synonyms
- **chatbot_match_history**: Match history
- **chatbot_training_examples**: Training examples

### Market Insights Tables

- **market_prices**: Actual market prices (KAMIS/Vendor)
- **predicted_prices**: AI-predicted prices
- **market_insights_metadata**: System metadata

### Advertisement Tables

- **advertisements**: Product advertisements
- **advertisement_analytics**: Advertisement analytics
- **advertisement_clicks**: Click tracking
- **advertisement_views**: View tracking

### Financial Tables

- **platform_commissions**: Platform commission records
- **vendor_earnings**: Vendor earnings records

### System Tables

- **notifications**: User notifications
- **admin_sessions**: Admin authentication sessions
- **backup_logs**: Backup logs
- **backup_settings**: Backup configuration
- **security_logs**: Security event logs
- **sms_logs**: SMS logs
- **sms_templates**: SMS templates
- **contact_messages**: Contact form submissions
- **otp_verification**: OTP verification codes
- **google_drive_logs**: Google Drive backup logs

### Relationship Overview

- **User → Vendor** (1:1): One user can have one vendor profile
- **Vendor → Products** (1:N): One vendor can have many products
- **Product → Orders** (1:N): One product can have many orders
- **User → Orders** (1:N): One user can have many orders
- **County → Constituencies → Wards** (Hierarchical): Location hierarchy

For a detailed ER diagram, see the database schema documentation.

---

## 📡 API Documentation

### Authentication

All API endpoints (except public endpoints) require authentication via JWT token.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

### Endpoints

#### User Management

- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - Login user
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile

#### Product Management

- `GET /api/products` - Get all products (with filters)
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product (Vendor only)
- `PUT /api/products/:id` - Update product (Vendor only)
- `DELETE /api/products/:id` - Delete product (Vendor only)

#### Order Management

- `GET /api/orders` - Get user orders
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order by ID
- `PUT /api/orders/:id` - Update order status

#### Vendor Management

- `GET /api/vendors` - Get all vendors
- `GET /api/vendors/products` - Get vendor products
- `GET /api/vendors/stats` - Get vendor statistics

#### Chat System

- `POST /api/chat/message` - Send chat message
- `GET /api/chat/conversations` - Get user conversations
- `GET /api/chat/conversations/:id` - Get conversation by ID
- `DELETE /api/chat/conversations/:id` - Delete conversation
- `GET /api/chat/settings/language` - Get language preference
- `PUT /api/chat/settings/language` - Update language preference

#### Market Insights

- `GET /api/market-insights/combined` - Get combined actual and predicted prices
- `GET /api/market-insights/filters` - Get filter options (products, counties)
- `GET /api/market-insights/prices` - Get actual prices
- `GET /api/market-insights/predictions` - Get predicted prices

#### Location

- `GET /api/location/counties` - Get all counties
- `GET /api/location/constituencies?county_id=:id` - Get constituencies by county
- `GET /api/location/wards?constituency_id=:id` - Get wards by constituency

#### Admin

- `POST /api/admin/login` - Admin login
- `GET /api/admin/stats` - Get platform statistics
- `GET /api/admin/vendors` - Get all vendors (with filters)
- `PUT /api/admin/vendors/:id/approve` - Approve vendor
- `GET /api/admin/products` - Get all products (with filters)
- `PUT /api/admin/products/:id/approve` - Approve product
- `GET /api/admin/orders` - Get all orders
- `GET /api/admin/advertisements` - Get all advertisements

### Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "details": "Optional error details"
}
```

### Status Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## 🚢 Deployment

### Production Deployment

1. **Build Frontend:**
```bash
npm run build
```

2. **Configure Production Environment:**
   - Update `.env` files with production values
   - Set `APP_ENV=production`
   - Configure production database
   - Set up SSL certificates

3. **Configure Web Server:**
   - Apache: Configure virtual host
   - Nginx: Configure server block
   - Set document root to `dist/` folder
   - Configure API routing

4. **Database Migration:**
   - Run database migrations
   - Set up database backups
   - Configure database replication (if needed)

5. **Set Up Cron Jobs:**
   - Configure cron jobs for scheduled tasks
   - Set up log rotation
   - Monitor cron job execution

6. **Security:**
   - Enable HTTPS
   - Configure firewall rules
   - Set up security monitoring
   - Regular security updates

### Docker Deployment (Future)

Docker configuration is not currently included but can be added for containerized deployment.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Commit your changes:**
   ```bash
   git commit -m "Add your feature description"
   ```
5. **Push to the branch:**
   ```bash
   git push origin feature/your-feature-name
   ```
6. **Create a Pull Request**

### Code Style

- **PHP**: Follow PSR-12 coding standards
- **JavaScript/TypeScript**: Follow ESLint rules
- **React**: Follow React best practices
- **SQL**: Use prepared statements, avoid SQL injection

### Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Update documentation for new features

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **KAMIS**: Kenya Agricultural Market Information System for market price data
- **Google Gemini**: For AI-powered image analysis and description generation
- **OpenRouter**: For general AI chat capabilities
- **React Community**: For excellent React libraries and tools
- **PHP Community**: For robust PHP frameworks and libraries

---

## 📞 Support

For support, please contact:
- **Email**: support@poultryhubkenya.com
- **Website**: https://poultryhubkenya.com
- **Facebook**: [PoultryHub KE](https://www.facebook.com/profile.php?id=100085312746341)
- **Twitter**: [@Stevegmail98](https://x.com/Stevegmail98)
- **Instagram**: [@steve_ronald54](https://www.instagram.com/steve_ronald54)

---

## 📊 Project Status

**Current Version:** 1.0.0

**Status:** ✅ Active Development

**Last Updated:** November 2024

---

## 🗺️ Roadmap

### Phase 1: Core Features ✅
- [x] User authentication and authorization
- [x] Product listings and management
- [x] Order management
- [x] Vendor profiles
- [x] Shopping cart
- [x] Payment integration

### Phase 2: AI & Chatbot ✅
- [x] AI-powered image verification
- [x] Automatic description generation
- [x] Hybrid chatbot system
- [x] Multi-language support (English, Kiswahili)

### Phase 3: Market Insights ✅
- [x] Real-time market prices
- [x] AI-powered price predictions
- [x] Interactive price charts
- [x] County-level filtering

### Phase 4: Advertisement System ✅
- [x] Product advertisements
- [x] Advertisement analytics
- [x] Click and view tracking

### Phase 5: Future Enhancements 🚧
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Payment gateway integration (M-Pesa, PayPal)
- [ ] Real-time notifications (WebSockets)
- [ ] Advanced search and filtering
- [ ] Product reviews and ratings
- [ ] Vendor verification system
- [ ] Multi-currency support
- [ ] International shipping

---

## 🔒 Security

This project follows security best practices:

- **Authentication**: JWT-based authentication
- **Authorization**: Role-based access control (RBAC)
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection Protection**: Prepared statements
- **XSS Protection**: Content sanitization
- **CSRF Protection**: CSRF tokens
- **Rate Limiting**: API rate limiting
- **Security Logging**: Comprehensive security event logging
- **Password Hashing**: bcrypt password hashing
- **Secure Cookies**: HttpOnly, Secure, SameSite cookies

---

## 📈 Performance

### Optimization Strategies

- **Frontend**: Code splitting, lazy loading, image optimization
- **Backend**: Database indexing, query optimization, caching
- **API**: Response caching, pagination, rate limiting
- **Database**: Indexed columns, optimized queries, connection pooling

### Monitoring

- **Error Logging**: Comprehensive error logging
- **Performance Monitoring**: Query performance monitoring
- **Security Monitoring**: Security event monitoring
- **Usage Analytics**: User behavior analytics

---

## 🐛 Known Issues

- None currently reported

---

## 📚 Additional Documentation

- [Database ER Diagram Prompt](DATABASE_ER_DIAGRAM_PROMPT.md) - For generating database ER diagrams
- [Backend Scripts README](backend/scripts/README.md) - Documentation for backend scripts
- [API Documentation](#api-documentation) - Detailed API documentation

---

## 🎉 Thank You!

Thank you for using **Poultry Hub Kenya**! We hope this platform helps connect the Kenyan poultry community and makes it easier for farmers and customers to trade poultry products.

For questions, suggestions, or feedback, please don't hesitate to contact us.

---

**Made with ❤️ for the Kenyan Poultry Community**

