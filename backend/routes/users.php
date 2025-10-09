<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/notifications.php';
require_once __DIR__ . '/../utils/security.php';

function handleLogin() {
    global $pdo;
    
    // Suppress error reporting for security
    error_reporting(E_ERROR | E_PARSE);
    ini_set('display_errors', 0);
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['email']) || !isset($input['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Email and password are required']);
        return;
    }
    
    $email = sanitizeInput($input['email']);
    $password = $input['password']; // Don't sanitize password as it might contain special chars
    
    // Rate limiting for login attempts
    $clientIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (!checkRateLimit('login_' . $clientIP, 5, 300)) { // 5 attempts per 5 minutes
        http_response_code(429);
        echo json_encode(['error' => 'Too many login attempts. Please try again later.']);
        return;
    }
    
    // Validate email format
    if (!validateEmail($email)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid email format']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM user_profiles WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid credentials']);
            return;
        }
        
        // Check password - only allow bcrypt hashed passwords
        $passwordValid = password_verify($password, $user['password']);
        
        if (!$passwordValid) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid credentials']);
            return;
        }
        
        // SECURITY CHECK: Prevent admins from logging in through regular user login
        if ($user['role'] === 'admin') {
            http_response_code(401);
            echo json_encode(['error' => 'Admin accounts must use the admin login page. Please go to /admin-login']);
            return;
        }
        
        $token = generateJWT($user['id'], $user['email'], $user['role']);
        
        // Get vendor approval status and details if user is a vendor
        $isApproved = true; // Default for non-vendors
        $vendorData = null;
        if ($user['role'] === 'vendor') {
            $stmt = $pdo->prepare("SELECT status, farm_name, farm_description, location, id_number FROM vendors WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
            $isApproved = $vendor && $vendor['status'] === 'approved';
            $vendorData = $vendor;
        }
        
        $response = [
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'name' => $user['full_name'],
                'role' => $user['role'],
                'phone' => $user['phone'],
                'isApproved' => $isApproved,
                'vendorData' => $vendorData
            ]
        ];
        
        // Debug logging for vendor data
        if ($user['role'] === 'vendor') {
            error_log('Vendor login - vendorData: ' . json_encode($vendorData));
        }
        
        echo json_encode($response);
        
    } catch (PDOException $e) {
        error_log('Database error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Login failed: ' . $e->getMessage()]);
    } catch (Exception $e) {
        error_log('General error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Login failed: ' . $e->getMessage()]);
    }
}

function handleRegister() {
    global $pdo;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $required_fields = ['email', 'password', 'full_name'];
    foreach ($required_fields as $field) {
        if (!isset($input[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Missing required field: $field"]);
            return;
        }
    }
    
    $email = $input['email'];
    $password = password_hash($input['password'], PASSWORD_DEFAULT);
    $full_name = $input['full_name'];
    $phone = $input['phone'] ?? null;
    $role = $input['role'] ?? 'customer';
    
    // SECURITY CHECK: Prevent admin registration through regular registration
    if ($role === 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Admin accounts cannot be registered through this form. Contact system administrator.']);
        return;
    }
    
    try {
        // Check if email already exists
        $stmt = $pdo->prepare("SELECT id FROM user_profiles WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Email already registered']);
            return;
        }
        
        // Create user
        $id = uniqid();
        $stmt = $pdo->prepare("INSERT INTO user_profiles (id, email, password, full_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$id, $email, $password, $full_name, $phone, $role]);
        
        // If vendor, create vendor profile
        if ($role === 'vendor') {
            $vendor_id = uniqid();
            $farm_name = $input['farm_name'] ?? '';
            $farm_description = $input['farm_description'] ?? '';
            $location = $input['location'] ?? '';
            $id_number = $input['id_number'] ?? null;
            
            $stmt = $pdo->prepare("INSERT INTO vendors (id, user_id, farm_name, farm_description, location, id_number, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')");
            $stmt->execute([$vendor_id, $id, $farm_name, $farm_description, $location, $id_number]);
            
            // Notify admins about new vendor registration
            notifyAllAdmins("New vendor registered: {$full_name} ({$farm_name})", 'info');
        } else {
            // Notify admins about new user registration
            $roleText = $role === 'admin' ? 'admin' : 'customer';
            notifyAllAdmins("New {$roleText} registered: {$full_name}", 'info');
        }
        
        http_response_code(201);
        echo json_encode(['message' => 'User registered successfully', 'id' => $id]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Registration failed: ' . $e->getMessage()]);
    }
}

function handleGetUser() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("SELECT id, email, full_name, phone, role FROM user_profiles WHERE id = ?");
        $stmt->execute([$payload['user_id']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            return;
        }
        
        // SECURITY CHECK: Prevent admins from accessing user data through regular API
        if ($user['role'] === 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Admin accounts must use the admin login page']);
            return;
        }
        
        // Get vendor approval status and data if user is a vendor
        $isApproved = true; // Default for non-vendors
        $vendorData = null;
        if ($user['role'] === 'vendor') {
            $stmt = $pdo->prepare("SELECT status, farm_name, farm_description, location, id_number FROM vendors WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
            $isApproved = $vendor && $vendor['status'] === 'approved';
            $vendorData = $vendor;
        }
        
        $user['isApproved'] = $isApproved;
        $user['vendorData'] = $vendorData;
        echo json_encode($user);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch user: ' . $e->getMessage()]);
    }
}
?>
