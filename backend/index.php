<?php
// Set timezone to Nairobi (UTC+3) for consistent date/time handling
date_default_timezone_set('Africa/Nairobi');

// Load environment variables FIRST before CORS configuration
require_once __DIR__ . '/config/env_loader.php';

header('Content-Type: application/json');
// Restrict CORS to specific origins for security
$allowedOrigins = [
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:3000',
    'http://localhost:5173', // Vite default port
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8081',
    'http://127.0.0.1:8082',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173' // Vite default port
];

// Add local network IPs from environment variable (for development)
// Use $_ENV or $_SERVER as fallback since getenv() might not work in all PHP configurations
$localNetworkIPs = getenv('LOCAL_NETWORK_ORIGINS') ?: ($_ENV['LOCAL_NETWORK_ORIGINS'] ?? $_SERVER['LOCAL_NETWORK_ORIGINS'] ?? '');
if ($localNetworkIPs) {
    $localIPs = explode(',', $localNetworkIPs);
    $allowedOrigins = array_merge($allowedOrigins, array_map('trim', $localIPs));
}

// Add production domains from environment
$productionDomains = getenv('ALLOWED_ORIGINS') ?: ($_ENV['ALLOWED_ORIGINS'] ?? $_SERVER['ALLOWED_ORIGINS'] ?? '');
if ($productionDomains) {
    $productionDomains = explode(',', $productionDomains);
    $allowedOrigins = array_merge($allowedOrigins, array_map('trim', $productionDomains));
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
// Default to Vite's default port (5173) or allow from environment
$defaultOrigin = getenv('DEFAULT_CORS_ORIGIN') ?: ($_ENV['DEFAULT_CORS_ORIGIN'] ?? $_SERVER['DEFAULT_CORS_ORIGIN'] ?? 'http://localhost:5173');

if (in_array($origin, $allowedOrigins) || strpos($origin, 'ngrok') !== false) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: ' . $defaultOrigin); // Default fallback
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Cache-Control, Pragma');
header('Access-Control-Allow-Credentials: true');

// Security headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: geolocation=(), microphone=(), camera=()');

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
$path = str_replace('index.php/', '', $path); // Remove index.php/ if present
$path = ltrim($path, '/'); // Remove leading slash

// Handle dynamic route for payment verification (before switch)
if (preg_match('#^api/payments/paystack/verify/([^/]+)$#', $path, $matches)) {
    $reference = $matches[1] ?? null;
    if ($method === 'GET' && $reference) {
        include 'routes/payments.php';
        handleVerifyPaystackPayment($reference);
        exit;
    }
}

// Handle dynamic route for payment status (before switch)
if (preg_match('#^api/payments/status/([^/]+)$#', $path, $matches)) {
    $orderId = $matches[1] ?? null;
    if ($method === 'GET' && $orderId) {
        include 'routes/payments.php';
        handleGetPaymentStatus($orderId);
        exit;
    }
}

// Handle dynamic routes for conversation deletion (before switch)
if (preg_match('#^api/chat/conversations/([^/]+)$#', $path, $matches)) {
    $conversationId = $matches[1] ?? null;
    if ($method === 'DELETE' && $conversationId) {
        include 'routes/chat.php';
        handleDeleteConversation($conversationId);
        exit;
    }
}

// Handle dynamic route for single product (before switch)
if (preg_match('#^api/products/([^/]+)$#', $path, $matches)) {
    $productId = $matches[1] ?? null;
    if ($method === 'GET' && $productId) {
        include 'routes/products.php';
        handleGetProduct($productId);
        exit;
    }
}

// Handle dynamic route for single conversation (before switch)
if (preg_match('#^api/conversations/([^/]+)$#', $path, $matches)) {
    $conversationId = $matches[1] ?? null;
    if ($method === 'DELETE' && $conversationId) {
        include 'routes/messages_new.php';
        $_GET['conversation_id'] = $conversationId;
        handleDeleteConversation();
        exit;
    }
    if ($method === 'GET' && $conversationId) {
        include 'routes/conversations.php';
        handleGetConversation($conversationId);
        exit;
    }
}

// Route the request
switch ($path) {
    case '':
        echo json_encode(['message' => 'KukuSoko API is running', 'status' => 'success']);
        break;
        
    case 'api/users/login':
        if ($method === 'POST') {
            include 'routes/users.php';
            handleLogin();
        }
        break;
        
    case 'api/auth/send-login-otp':
        if ($method === 'POST') {
            include 'routes/login_2fa.php';
            handleSendLoginOTP();
        }
        break;
        
    case 'api/auth/verify-login-otp':
        if ($method === 'POST') {
            include 'routes/login_2fa.php';
            handleVerifyLoginOTP();
        }
        break;

    case 'api/auth/send-register-otp':
        if ($method === 'POST') {
            include 'routes/register_2fa.php';
            handleSendRegisterOTP();
        }
        break;

    case 'api/auth/verify-register-otp':
        if ($method === 'POST') {
            include 'routes/register_2fa.php';
            handleVerifyRegisterOTP();
        }
        break;

    case 'api/auth/resend-register-otp':
        if ($method === 'POST') {
            include 'routes/register_2fa.php';
            handleResendRegisterOTP();
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
        
    case 'api/users/profile':
        if ($method === 'PUT') {
            include 'routes/users.php';
            handleUpdateUserProfile();
        }
        break;
        
    case 'api/location/counties':
        if ($method === 'GET') {
            include 'routes/location.php';
            handleGetCounties();
        }
        break;
        
    case 'api/location/constituencies':
        if ($method === 'GET') {
            include 'routes/location.php';
            handleGetConstituencies();
        }
        break;
        
    case 'api/location/wards':
        if ($method === 'GET') {
            include 'routes/location.php';
            handleGetWards();
        }
        break;
        
    case 'api/location/all':
        if ($method === 'GET') {
            include 'routes/location.php';
            handleGetAllLocations();
        }
        break;
        
    case 'api/products':
        if ($method === 'GET') {
            include 'routes/products.php';
            handleGetProducts();
        }
        break;

    case 'api/messages':
        if ($method === 'GET') {
            include 'routes/messages_new.php';
            handleGetMessages();
        } elseif ($method === 'POST') {
            include 'routes/messages.php';
            handleSendMessage();
        }
        break;
        
    case 'api/messages/send':
        if ($method === 'POST') {
            include 'routes/messages_new.php';
            handleSendMessage();
        }
        break;
        
    case 'api/messages/read':
        if ($method === 'POST') {
            include 'routes/messages_new.php';
            handleMarkMessagesAsRead();
        }
        break;
        
    case 'api/messages/delete':
        if ($method === 'DELETE') {
            include 'routes/messages_new.php';
            handleDeleteMessage();
        }
        break;
        
    case 'api/conversations/create':
        if ($method === 'POST') {
            include 'routes/conversations.php';
            handleCreateConversation();
        }
        break;
        
    case 'api/conversations':
        if ($method === 'GET') {
            include 'routes/conversations.php';
            handleGetConversations();
        }
        break;
        
    case 'api/vendor/conversations':
        // Redirect to new conversations endpoint
        if ($method === 'GET') {
            include 'routes/conversations.php';
            handleGetConversations();
        }
        break;
        
    case 'api/user/conversations':
        if ($method === 'GET') {
            include 'routes/messages.php';
            handleGetUserConversations();
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
        
    case 'api/admin/commission-data':
        if ($method === 'GET') {
            include 'routes/admin.php';
            handleAdminCommissionData();
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
        
    case 'api/admin/sms/logs':
        if ($method === 'GET') {
            include 'routes/sms.php';
            handleGetSMSLogs();
        }
        break;
        
    case 'api/admin/sms/stats':
        if ($method === 'GET') {
            include 'routes/sms.php';
            handleGetSMSStats();
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
        
    // Chatbot Routes
    case 'api/chat/message':
        if ($method === 'POST') {
            include 'routes/chat.php';
            handleChatMessage();
        }
        break;
        
    case 'api/chat/history':
        if ($method === 'GET') {
            include 'routes/chat.php';
            handleGetChatHistory();
        }
        break;
        
    case 'api/chat/feedback':
        if ($method === 'POST' || $method === 'GET') {
            include 'routes/chat_feedback.php';
        }
        break;
        
    case 'api/chat/settings/language':
        if ($method === 'POST' || $method === 'GET') {
            include 'routes/chat_settings.php';
            if ($method === 'POST') {
                handleUpdateLanguagePreference();
            } else {
                handleGetLanguagePreference();
            }
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
        
    case 'api/admin/session/validate':
        if ($method === 'POST') {
            include 'routes/admin.php';
            handleValidateAdminSession();
        }
        break;
        
    case 'api/admin/profile':
        if ($method === 'PUT') {
            include 'routes/admin.php';
            handleUpdateAdminProfile();
        }
        break;
        
    case 'api/admin/me':
        if ($method === 'GET') {
            include 'routes/admin.php';
            handleGetAdminProfile();
        }
        break;
        
    case 'api/admin/contact-messages/delete':
        if ($method === 'DELETE') {
            include 'routes/admin.php';
            handleDeleteContactMessage();
        }
        break;
        
    case 'api/admin/orders/delete':
        if ($method === 'DELETE') {
            include 'routes/admin.php';
            handleDeleteOrder();
        }
        break;
        
    case 'api/admin/users/toggle-status':
        if ($method === 'PUT') {
            include 'routes/admin.php';
            handleToggleUserAccountStatus();
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
        
    case 'api/vendor/earnings':
        if ($method === 'GET') {
            include 'routes/vendors.php';
            handleGetVendorEarnings();
        }
        break;
        
    case 'api/vendor/profile':
        if ($method === 'PUT') {
            include 'routes/vendors.php';
            handleUpdateVendorProfile();
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
        
    // Backup system routes
    case 'api/admin/backup/create':
        if ($method === 'POST') {
            include 'routes/backup.php';
            handleCreateBackup();
        }
        break;
        
    case 'api/admin/backup/list':
        if ($method === 'GET') {
            include 'routes/backup.php';
            handleListBackups();
        }
        break;
        
    case 'api/admin/backup/download':
        if ($method === 'GET') {
            include 'routes/backup.php';
            handleDownloadBackup();
        }
        break;
        
    case 'api/admin/backup/delete':
        if ($method === 'DELETE') {
            include 'routes/backup.php';
            handleDeleteBackup();
        }
        break;
        
    case 'api/admin/backup/status':
        if ($method === 'GET') {
            include 'routes/backup.php';
            handleBackupStatus();
        }
        break;
        
    case 'api/admin/backup/restore':
        if ($method === 'POST') {
            include 'routes/backup.php';
            handleRestoreBackup();
        }
        break;
        
    case 'api/admin/backup/logs':
        if ($method === 'GET') {
            include 'routes/backup.php';
            handleBackupLogs();
        }
        break;
        
    case 'api/admin/backup/settings':
        if ($method === 'GET') {
            include 'routes/backup_settings.php';
            handleGetBackupSettings();
        } elseif ($method === 'PUT') {
            include 'routes/backup_settings.php';
            handleUpdateBackupSettings();
        }
        break;
        
    case 'api/admin/backup/test':
        if ($method === 'GET') {
            include 'routes/backup_settings.php';
            handleTestBackupConnection();
        }
        break;
        
    case 'api/admin/backup/test-email':
        if ($method === 'POST') {
            include 'routes/backup_settings.php';
            handleTestEmail();
        }
        break;
        
    case 'api/admin/backup/setup-windows-task':
        if ($method === 'POST') {
            include 'routes/backup_settings.php';
            handleSetupWindowsTask();
        }
        break;
        
    case 'api/admin/backup/windows-task-status':
        if ($method === 'GET') {
            include 'routes/backup_settings.php';
            handleWindowsTaskStatus();
        }
        break;
        
    case 'api/admin/backup/stop-windows-task':
        if ($method === 'POST') {
            include 'routes/backup_settings.php';
            handleStopWindowsTask();
        }
        break;
        
    // Google Drive backup routes
    case 'api/admin/google-drive/upload':
        if ($method === 'POST') {
            include 'routes/google_drive_backup.php';
            handleGoogleDriveUpload();
        }
        break;
        
    case 'api/admin/google-drive/list':
        if ($method === 'GET') {
            include 'routes/google_drive_backup.php';
            handleGoogleDriveList();
        }
        break;
        
    case 'api/admin/google-drive/delete':
        if ($method === 'DELETE') {
            include 'routes/google_drive_backup.php';
            handleGoogleDriveDelete();
        }
        break;
        
    case 'api/admin/google-drive/test':
        if ($method === 'GET') {
            include 'routes/google_drive_backup.php';
            handleGoogleDriveTest();
        }
        break;
        
    case 'api/admin/google-drive/logs':
        if ($method === 'GET') {
            include 'routes/google_drive_backup.php';
            handleGoogleDriveLogs();
        }
        break;
        
    case 'api/admin/google-drive/folder-info':
        if ($method === 'GET') {
            include 'routes/google_drive_backup.php';
            handleGoogleDriveFolderInfo();
        }
        break;
        
    // Advertisement routes
    case 'api/advertisements':
        if ($method === 'GET') {
            include 'routes/advertisements.php';
            handleGetActiveAdvertisements();
        }
        break;
        
    case 'api/vendor/advertisements':
        if ($method === 'GET') {
            include 'routes/advertisements.php';
            handleGetVendorAdvertisements();
        } elseif ($method === 'POST') {
            include 'routes/advertisements.php';
            handleCreateAdvertisement();
        } elseif ($method === 'PUT') {
            include 'routes/advertisements.php';
            handleUpdateVendorAdvertisement();
        } elseif ($method === 'DELETE') {
            include 'routes/advertisements.php';
            handleDeleteAdvertisement();
        }
        break;
        
    case 'api/vendor/advertisements/analytics':
        if ($method === 'GET') {
            include 'routes/advertisements.php';
            $adId = $_GET['ad_id'] ?? null;
            if ($adId) {
                handleGetAdvertisementAnalytics($adId);
            } else {
                http_response_code(400);
                echo json_encode(['error' => 'ad_id parameter required']);
            }
        }
        break;
        
    case 'api/admin/advertisements':
        if ($method === 'GET') {
            include 'routes/advertisements.php';
            handleGetAdminAdvertisements();
        } elseif ($method === 'PUT') {
            include 'routes/advertisements.php';
            handleUpdateAdminAdvertisement();
        } elseif ($method === 'DELETE') {
            include 'routes/advertisements.php';
            handleDeleteAdvertisement();
        }
        break;
        
    case 'api/admin/advertisements/approve':
        if ($method === 'POST') {
            include 'routes/advertisements.php';
            handleApproveAdvertisement();
        }
        break;
        
    case 'api/admin/advertisements/reject':
        if ($method === 'POST') {
            include 'routes/advertisements.php';
            handleRejectAdvertisement();
        }
        break;
        
    case 'api/advertisements/track-view':
        if ($method === 'POST') {
            include 'routes/advertisements.php';
            handleTrackAdView();
        }
        break;
        
    case 'api/advertisements/track-click':
        if ($method === 'POST') {
            include 'routes/advertisements.php';
            handleTrackAdClick();
        }
        break;
        
    case 'api/advertisements/reactivate':
        if ($method === 'POST') {
            include 'routes/advertisements.php';
            handleReactivateAdvertisement();
        }
        break;
    case 'api/admin/system-logs':
        if ($method === 'GET') {
            include 'routes/system_logs.php';
            handleGetSystemLogs();
        }
        break;
        
    case 'api/admin/system-logs/actions':
        if ($method === 'GET') {
            include 'routes/system_logs.php';
            handleGetLogActions();
        }
        break;
    case 'api/ratings':
        include 'routes/ratings.php';
        // Functions handle routing internally based on method and query params
        break;
        
    // Payment routes
    case 'api/payments/paystack/initialize':
        if ($method === 'POST') {
            include 'routes/payments.php';
            handleInitializePaystackPayment();
        }
        break;
        
    case 'api/payments/paystack/webhook':
        if ($method === 'POST') {
            include 'routes/payments.php';
            handlePaystackWebhook();
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
        } elseif (strpos($path, 'api/notifications/') === 0 && $method === 'DELETE') {
            include 'routes/notifications.php';
            handleDeleteNotification();
        } elseif (strpos($path, 'api/admin/sms-logs/') === 0 && $method === 'DELETE') {
            include 'routes/sms.php';
            handleDeleteSMSLog();
        } elseif (strpos($path, 'api/admin/sms-logs/') === 0 && strpos($path, '/retry') && $method === 'POST') {
            include 'routes/sms.php';
            handleRetrySMS();
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Endpoint not found']);
        }
        break;
}
?>
