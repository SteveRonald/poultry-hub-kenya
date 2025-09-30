# Poultry Hub Kenya

Kenya's Premier Poultry Marketplace - Connect with trusted poultry farmers across Kenya.

## Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS + Vite
- **Backend:** PHP + MySQL (XAMPP)
- **Database:** MySQL
- **Development:** Single command setup with concurrently

## Setup Instructions

### Prerequisites

- Node.js (for frontend)
- XAMPP (for MySQL database)
- PHP (comes with XAMPP)

### 1. Database Setup

1. Start XAMPP and ensure MySQL is running
2. Open phpMyAdmin (<http://localhost/phpmyadmin>)
3. Import the `database_setup.sql` file to create the database and tables
4. Or run the SQL commands manually in phpMyAdmin

### 2. Backend Setup

1. The PHP backend is already configured in the `backend/` folder
2. Make sure your MySQL credentials in `backend/config/database.php` match your XAMPP setup:

   ```php
   $host = 'localhost';
   $dbname = 'poultry_hub_kenya';
   $username = 'root';
   $password = ''; // Default XAMPP password is empty
   ```

### 3. Frontend Setup

1. Install dependencies:

   ```bash
   npm install
   ```

   (concurrently is already included in the project)

### 4. Running the Application

#### Single Command (Recommended)

```bash
npm run dev
```

This will start both the React frontend and PHP backend simultaneously.

#### Alternative: Run Servers Separately

**Terminal 1 (Frontend):**

```bash
npx vite
```

**Terminal 2 (Backend):**

```bash
cd backend
php -S localhost:8000
```

### 5. Access the Application

- **Frontend:** <http://localhost:8080>
- **Backend API:** <http://localhost/poultry-hub-kenya/backend>

## Default Login Credentials

### Admin

- Email: <kothroni863@gmail.com>
- Password: password
- Login Page: Use `/admin-login` (separate admin login page)

### Sample Customer

- Email: <okothroni863@gmail.com>
- Password: (check your database for the actual password)
- Login Page: Use `/login` (unified login page)

### Sample Vendor

- Email: <martin23@gmail.com>
- Password: password
- Login Page: Use `/login` (unified login page)
- Status: Approved (can access vendor dashboard)

## API Endpoints

### Authentication

- `POST /api/users/login` - User login
- `POST /api/users/register` - User registration
- `GET /api/users/me` - Get current user (requires token)

### Products

- `GET /api/products` - Get all products
- `GET /api/products?search=term` - Search products
- `GET /api/products?category=chicks` - Filter by category
- `GET /api/products?location=Nairobi` - Filter by location

### Orders

- `GET /api/orders?user_id=123` - Get user orders
- `POST /api/orders` - Create new order

### Vendors

- `GET /api/vendors` - Get approved vendors

### Notifications

- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/read` - Mark notification as read

### Admin

- `POST /api/adminlogin` - Admin login
- `POST /api/admin/logout` - Admin logout
- `GET /api/admin/stats` - Get admin dashboard statistics
- `GET /api/admin/vendors` - Get all vendors for admin
- `GET /api/admin/products` - Get all products for admin
- `GET /api/admin/orders` - Get all orders for admin
- `GET /api/admin/users` - Get all users for admin
- `PUT /api/admin/vendors/approve` - Approve vendor
- `PUT /api/admin/vendors/reject` - Reject vendor
- `PUT /api/admin/products/approve` - Approve product
- `PUT /api/admin/products/reject` - Reject product

### Vendor

- `GET /api/vendor/products` - Get vendor's products
- `POST /api/vendor/products` - Create new product
- `GET /api/vendor/stats` - Get vendor dashboard statistics
- `GET /api/vendor/orders` - Get vendor's orders

## Project Structure

```
poultry-hub-kenya/
├── src/                    # React frontend
│   ├── components/         # Reusable components
│   ├── pages/             # Page components
│   ├── contexts/          # React contexts
│   └── hooks/             # Custom hooks
├── backend/               # PHP backend
│   ├── routes/            # API route handlers
│   ├── config/            # Configuration files
│   └── utils/             # Utility functions
├── database_setup.sql     # Database schema
└── start-dev.bat/sh       # Development scripts
```

## Features

- ✅ User authentication and authorization
- ✅ Product browsing and search
- ✅ Vendor management
- ✅ Order management
- ✅ Admin dashboard
- ✅ Responsive design
- ✅ Real-time notifications

## Development Notes

- The frontend remains unchanged (React + TypeScript)
- Only the backend has been converted from Node.js to PHP
- All API endpoints maintain the same structure
- Database schema is compatible with existing frontend expectations
- CORS is enabled for development

## Troubleshooting

1. **Database Connection Issues:**
   - Ensure XAMPP MySQL is running
   - Check database credentials in `backend/config/database.php`
   - Verify database exists and tables are created

2. **Port Conflicts:**
   - Frontend runs on port 8080
   - Backend runs on port 8000
   - Change ports in respective configuration files if needed

3. **CORS Issues:**
   - CORS headers are set in `backend/index.php`
   - Ensure frontend is calling the correct backend URL (localhost:8000)
