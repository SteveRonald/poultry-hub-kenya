<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Include database configuration
require_once 'config/database.php';

// Get the request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = str_replace('/poultry-hub-kenya/backend/', '', $path);
$path = str_replace('/backend/', '', $path);

// Route the request
switch ($path) {
    case '':
        echo json_encode(['message' => 'Poultry Hub Kenya API is running', 'status' => 'success']);
        break;
        
    case 'api/users/login':
        if ($method === 'POST') {
            include 'routes/users.php';
            handleLogin();
        }
        break;
        
    case 'api/users/register':
        if ($method === 'POST') {
            include 'routes/users.php';
            handleRegister();
        }
        break;
        
    case 'api/users/me':
        if ($method === 'GET') {
            include 'routes/users.php';
            handleGetUser();
        }
        break;
        
    case 'api/products':
        if ($method === 'GET') {
            include 'routes/products.php';
            handleGetProducts();
        }
        break;
        
    case 'api/orders':
        if ($method === 'GET') {
            include 'routes/orders.php';
            handleGetOrders();
        } elseif ($method === 'POST') {
            include 'routes/orders.php';
            handleCreateOrder();
        }
        break;
        
    case 'api/vendors':
        if ($method === 'GET') {
            include 'routes/vendors.php';
            handleGetVendors();
        }
        break;
        
    case 'api/notifications':
        if ($method === 'GET') {
            include 'routes/notifications.php';
            handleGetNotifications();
        } elseif ($method === 'POST') {
            include 'routes/notifications.php';
            handleCreateNotification();
        }
        break;
        
    case 'api/notifications/read':
        if ($method === 'PUT') {
            include 'routes/notifications.php';
            handleMarkAsRead();
        }
        break;
        
    case 'api/adminlogin':
        if ($method === 'POST') {
            include 'routes/admin.php';
            handleAdminLogin();
        }
        break;
        
    case 'api/admin/stats':
        if ($method === 'GET') {
            include 'routes/admin.php';
            handleAdminStats();
        }
        break;
        
    case 'api/admin/vendors':
        if ($method === 'GET') {
            include 'routes/admin.php';
            handleAdminVendors();
        }
        break;
        
    case 'api/admin/products':
        if ($method === 'GET') {
            include 'routes/admin.php';
            handleAdminProducts();
        }
        break;
        
    case 'api/admin/orders':
        if ($method === 'GET') {
            include 'routes/admin.php';
            handleAdminOrders();
        }
        break;
        
    case 'api/admin/users':
        if ($method === 'GET') {
            include 'routes/admin.php';
            handleAdminUsers();
        }
        break;
        
    case 'api/admin/logout':
        if ($method === 'POST') {
            include 'routes/admin.php';
            handleAdminLogout();
        }
        break;
        
    case 'api/admin/vendors/approve':
        if ($method === 'PUT') {
            include 'routes/admin.php';
            handleVendorApproval();
        }
        break;
        
    case 'api/admin/vendors/reject':
        if ($method === 'PUT') {
            include 'routes/admin.php';
            handleVendorRejection();
        }
        break;
        
    case 'api/admin/products/approve':
        if ($method === 'PUT') {
            include 'routes/admin.php';
            handleProductApproval();
        }
        break;
        
    case 'api/admin/products/reject':
        if ($method === 'PUT') {
            include 'routes/admin.php';
            handleProductRejection();
        }
        break;
        
    case 'api/vendor/products':
        if ($method === 'GET') {
            include 'routes/vendors.php';
            handleGetVendorProducts();
        } elseif ($method === 'POST') {
            include 'routes/vendors.php';
            handleCreateProduct();
        }
        break;
        
    case 'api/vendor/stats':
        if ($method === 'GET') {
            include 'routes/vendors.php';
            handleGetVendorStats();
        }
        break;
        
    case 'api/vendor/orders':
        if ($method === 'GET') {
            include 'routes/vendors.php';
            handleGetVendorOrders();
        }
        break;
        
    case 'api/upload':
        if ($method === 'POST') {
            include 'routes/upload.php';
            handleImageUpload();
        }
        break;
        
    case 'api/upload/multiple':
        if ($method === 'POST') {
            include 'routes/upload.php';
            handleMultipleImageUpload();
        }
        break;
        
    default:
        // Handle dynamic routes like /api/vendor/products/{id}
        if (strpos($path, 'api/vendor/products/') === 0 && $method === 'PUT') {
            include 'routes/vendors.php';
            handleUpdateProduct();
        } elseif (strpos($path, 'api/vendor/products/') === 0 && $method === 'DELETE') {
            include 'routes/vendors.php';
            handleDeleteProduct();
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Endpoint not found']);
        }
        break;
}
?>
