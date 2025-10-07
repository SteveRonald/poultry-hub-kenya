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
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$requestUri = $_SERVER['REQUEST_URI'] ?? '/api/admin/analytics';
$path = parse_url($requestUri, PHP_URL_PATH);
$path = str_replace('/poultry-hub-kenya/backend/', '', $path);
$path = str_replace('/backend/', '', $path);
$path = ltrim($path, '/'); // Remove leading slash

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
        
    case 'api/admin/login':
        if ($method === 'POST') {
            include 'routes/admin.php';
            handleAdminLogin();
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
        
    case 'api/admin/orders/status':
        if ($method === 'PUT') {
            include 'routes/admin.php';
            handleUpdateOrderStatus();
        }
        break;
        
    case 'api/admin/analytics':
        if ($method === 'GET') {
            include 'routes/analytics.php';
            handleAdminAnalytics();
        }
        break;
        
    case 'api/vendor/analytics':
        if ($method === 'GET') {
            include 'routes/analytics.php';
            handleVendorAnalytics();
        }
        break;
        
    // AI Services Routes
    case 'api/ai/analyze-image':
        if ($method === 'POST') {
            include 'routes/ai_services.php';
            handleImageAnalysis();
        }
        break;
        
    case 'api/ai/generate-description':
        if ($method === 'POST') {
            include 'routes/ai_services.php';
            handleDescriptionGeneration();
        }
        break;
        
    case 'api/ai/moderate-content':
        if ($method === 'POST') {
            include 'routes/ai_services.php';
            handleContentModeration();
        }
        break;
        
    case 'api/ai/product-suggestions':
        if ($method === 'POST') {
            include 'routes/ai_services.php';
            handleProductSuggestions();
        }
        break;
        
    case 'api/ai/config':
        if ($method === 'GET') {
            include 'routes/ai_services.php';
            handleAIConfig();
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
        
    case 'api/vendor/orders/status':
        if ($method === 'PUT') {
            include 'routes/vendors.php';
            handleUpdateVendorOrderStatus();
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
        
    case 'api/contact':
        if ($method === 'POST') {
            include 'routes/contact.php';
            handleContactForm();
        } elseif ($method === 'GET') {
            include 'routes/contact.php';
            handleGetContactMessages();
        } elseif ($method === 'PUT') {
            include 'routes/contact.php';
            handleReplyToContact();
        }
        break;
        
    case 'api/cart':
        if ($method === 'GET') {
            include 'routes/cart.php';
            handleGetCart();
        } elseif ($method === 'POST') {
            include 'routes/cart.php';
            handleAddToCart();
        } elseif ($method === 'PUT') {
            include 'routes/cart.php';
            handleUpdateCartItem();
        } elseif ($method === 'DELETE') {
            include 'routes/cart.php';
            handleRemoveFromCart();
        }
        break;
        
    case 'api/cart/clear':
        if ($method === 'DELETE') {
            include 'routes/cart.php';
            handleClearCart();
        }
        break;
        
    case 'api/orders':
        if ($method === 'GET') {
            include 'routes/orders.php';
            handleGetOrders();
        } elseif ($method === 'POST') {
            include 'routes/orders.php';
            handleCreateOrder();
        } elseif ($method === 'PUT') {
            include 'routes/orders.php';
            handleUpdateOrderStatus();
        }
        break;
        
    case 'api/orders/shipping':
        if ($method === 'PUT') {
            include 'routes/orders.php';
            handleUpdateCustomerShippingAddress();
        }
        break;
        
    case 'api/forgot-password':
        if ($method === 'POST') {
            include 'routes/password_reset.php';
            handleForgotPassword();
        }
        break;
        
    case 'api/verify-otp':
        if ($method === 'POST') {
            include 'routes/password_reset.php';
            handleVerifyOTP();
        }
        break;
        
    case 'api/reset-password':
        if ($method === 'POST') {
            include 'routes/password_reset.php';
            handleResetPassword();
        }
        break;
        
    case 'api/resend-otp':
        if ($method === 'POST') {
            include 'routes/password_reset.php';
            handleResendOTP();
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
        } elseif (strpos($path, 'api/admin/users/') === 0 && $method === 'PUT') {
            include 'routes/admin.php';
            handleUpdateUser();
        } elseif (strpos($path, 'api/admin/users/') === 0 && $method === 'DELETE') {
            include 'routes/admin.php';
            handleDeleteUser();
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Endpoint not found']);
        }
        break;
}
?>
