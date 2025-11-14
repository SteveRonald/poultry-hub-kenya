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
        
        // Check if account is disabled
        if ($user['account_status'] === 'disabled') {
            http_response_code(403);
            echo json_encode(['error' => 'Your account has been disabled. Please contact support for assistance.']);
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
        // SECURITY: Don't expose database error details to users
        echo json_encode(['error' => 'Login failed. Please try again.']);
    } catch (Exception $e) {
        error_log('General error: ' . $e->getMessage());
        http_response_code(500);
        // SECURITY: Don't expose error details to users
        echo json_encode(['error' => 'Login failed. Please try again.']);
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
        
        // Check if phone already exists (if provided)
        if ($phone) {
            $stmt = $pdo->prepare("SELECT id FROM user_profiles WHERE phone = ?");
            $stmt->execute([$phone]);
            if ($stmt->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'Phone number already registered']);
                return;
            }
        }
        
        // If vendor, check for duplicate vendor-specific details
        if ($role === 'vendor') {
            $farm_name = $input['farm_name'] ?? '';
            $id_number = $input['id_number'] ?? null;
            
            // Check if farm name already exists
            if ($farm_name) {
                $stmt = $pdo->prepare("SELECT id FROM vendors WHERE farm_name = ?");
                $stmt->execute([$farm_name]);
                if ($stmt->fetch()) {
                    http_response_code(409);
                    echo json_encode(['error' => 'Farm name already registered. Please choose a different farm name.']);
                    return;
                }
            }
            
            // Check if ID number already exists (if provided)
            if ($id_number) {
                $stmt = $pdo->prepare("SELECT id FROM vendors WHERE id_number = ?");
                $stmt->execute([$id_number]);
                if ($stmt->fetch()) {
                    http_response_code(409);
                    echo json_encode(['error' => 'ID number already registered. Please check your ID number.']);
                    return;
                }
            }
        }
        
        // Create user
        $id = uniqid();
        $stmt = $pdo->prepare("INSERT INTO user_profiles (id, email, password, full_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$id, $email, $password, $full_name, $phone, $role]);
        
        // If vendor, create vendor profile
        if ($role === 'vendor') {
            $vendor_id = uniqid();
            $farm_description = $input['farm_description'] ?? '';
            $location = $input['location'] ?? ''; // Keep for backward compatibility
            
            // Get location IDs (vendor-only fields)
            $county_id = isset($input['county_id']) && $input['county_id'] ? (int)$input['county_id'] : null;
            $constituency_id = isset($input['constituency_id']) && $input['constituency_id'] ? (int)$input['constituency_id'] : null;
            $ward_id = isset($input['ward_id']) && $input['ward_id'] ? (int)$input['ward_id'] : null;
            
            // Validate location IDs if provided
            if ($county_id) {
                $stmt = $pdo->prepare("SELECT county_id FROM counties WHERE county_id = ?");
                $stmt->execute([$county_id]);
                if (!$stmt->fetch()) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Invalid county_id']);
                    return;
                }
            }
            
            if ($constituency_id) {
                $stmt = $pdo->prepare("SELECT constituency_id FROM constituencies WHERE constituency_id = ? AND county_id = ?");
                $stmt->execute([$constituency_id, $county_id]);
                if (!$stmt->fetch()) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Invalid constituency_id or constituency does not belong to selected county']);
                    return;
                }
            }
            
            if ($ward_id) {
                $stmt = $pdo->prepare("SELECT ward_id FROM wards WHERE ward_id = ? AND constituency_id = ?");
                $stmt->execute([$ward_id, $constituency_id]);
                if (!$stmt->fetch()) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Invalid ward_id or ward does not belong to selected constituency']);
                    return;
                }
            }
            
            // Insert vendor with location IDs
            $stmt = $pdo->prepare("INSERT INTO vendors (id, user_id, farm_name, farm_description, location, id_number, county_id, constituency_id, ward_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')");
            $stmt->execute([$vendor_id, $id, $farm_name, $farm_description, $location, $id_number, $county_id, $constituency_id, $ward_id]);
            
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
            $stmt = $pdo->prepare("
                SELECT v.status, v.farm_name, v.farm_description, v.location, v.id_number,
                       v.county_id, v.constituency_id, v.ward_id,
                       c.county_name, co.constituency_name, w.ward_name
                FROM vendors v
                LEFT JOIN counties c ON v.county_id = c.county_id
                LEFT JOIN constituencies co ON v.constituency_id = co.constituency_id
                LEFT JOIN wards w ON v.ward_id = w.ward_id
                WHERE v.user_id = ?
            ");
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

function handleUpdateUserProfile() {
    global $pdo;

    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }

    $payload = validateJWT($token);
    if (!$payload || empty($payload['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload']);
        return;
    }

    $userId = $payload['user_id'];
    $updateFields = [];
    $updateValues = [];

    if (array_key_exists('full_name', $input)) {
        $fullName = trim((string)$input['full_name']);
        if ($fullName === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Full name cannot be empty']);
            return;
        }
        $updateFields[] = "full_name = ?";
        $updateValues[] = $fullName;
    }

    if (array_key_exists('email', $input)) {
        $email = trim((string)$input['email']);
        if ($email === '' || !validateEmail($email)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid email address']);
            return;
        }

        try {
            $stmt = $pdo->prepare("SELECT id FROM user_profiles WHERE email = ? AND id != ?");
            $stmt->execute([$email, $userId]);
            if ($stmt->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'Email already in use by another account']);
                return;
            }
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to validate email: ' . $e->getMessage()]);
            return;
        }

        $updateFields[] = "email = ?";
        $updateValues[] = $email;
    }

    if (array_key_exists('phone', $input)) {
        $phone = $input['phone'];
        if ($phone !== null) {
            $phone = trim((string)$phone);
            if ($phone !== '' && !validatePhone($phone)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid phone number']);
                return;
            }
            $phone = $phone !== '' ? $phone : null;
        }

        try {
            if ($phone) {
                $stmt = $pdo->prepare("SELECT id FROM user_profiles WHERE phone = ? AND id != ?");
                $stmt->execute([$phone, $userId]);
                if ($stmt->fetch()) {
                    http_response_code(409);
                    echo json_encode(['error' => 'Phone number already in use by another account']);
                    return;
                }
            }
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to validate phone number: ' . $e->getMessage()]);
            return;
        }

        $updateFields[] = "phone = ?";
        $updateValues[] = $phone;
    }

    if (array_key_exists('language_preference', $input)) {
        $language = trim((string)$input['language_preference']);
        if ($language !== '') {
            $updateFields[] = "language_preference = ?";
            $updateValues[] = $language;
        } else {
            $updateFields[] = "language_preference = NULL";
        }
    }

    if (empty($updateFields)) {
        http_response_code(400);
        echo json_encode(['error' => 'No valid fields to update']);
        return;
    }

    // Append updated_at field
    $updateFields[] = "updated_at = NOW()";

    try {
        $sql = "UPDATE user_profiles SET " . implode(', ', $updateFields) . " WHERE id = ?";
        $updateValues[] = $userId;
        $stmt = $pdo->prepare($sql);
        $stmt->execute($updateValues);

        // Return updated profile
        $stmt = $pdo->prepare("SELECT id, email, full_name, phone, role FROM user_profiles WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            return;
        }

        // Include vendor status when applicable
        $isApproved = true;
        $vendorData = null;
        if ($user['role'] === 'vendor') {
            $stmt = $pdo->prepare("
                SELECT status, farm_name, farm_description, location, id_number,
                       county_id, constituency_id, ward_id
                FROM vendors
                WHERE user_id = ?
            ");
            $stmt->execute([$userId]);
            $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
            $isApproved = $vendor && $vendor['status'] === 'approved';
            $vendorData = $vendor;
        }

        echo json_encode([
            'success' => true,
            'message' => 'Profile updated successfully',
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'full_name' => $user['full_name'],
                'phone' => $user['phone'],
                'role' => $user['role'],
                'isApproved' => $isApproved,
                'vendorData' => $vendorData
            ]
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update profile: ' . $e->getMessage()]);
    }
}
?>
