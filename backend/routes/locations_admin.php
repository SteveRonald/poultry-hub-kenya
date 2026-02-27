<?php
/**
 * Admin Locations API (Warehouses and Pickup Stations)
 */

require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/security.php';

function handleGetAdminWarehouses() {
    global $pdo;
    
    // Check if user is admin
    if (!isAdmin()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Unauthorized access']);
        return;
    }
    
    try {
        $stmt = $pdo->query("SELECT w.*, c.county_name 
                            FROM warehouses w 
                            JOIN counties c ON w.county_id = c.county_id 
                            ORDER BY c.county_name ASC, w.name ASC");
        $warehouses = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'data' => $warehouses]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
}

function handleCreateWarehouse() {
    global $pdo;
    
    if (!isAdmin()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Unauthorized access']);
        return;
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $name = $data['name'] ?? null;
    $address = $data['address'] ?? null;
    $county_id = $data['county_id'] ?? null;
    
    if (!$name || !$county_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Name and county_id are required']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("INSERT INTO warehouses (name, address, county_id) VALUES (?, ?, ?)");
        $stmt->execute([$name, $address, $county_id]);
        
        echo json_encode(['success' => true, 'message' => 'Warehouse created successfully', 'id' => $pdo->lastInsertId()]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
}

function handleUpdateWarehouse($id) {
    global $pdo;
    
    if (!isAdmin()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Unauthorized access']);
        return;
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $name = $data['name'] ?? null;
    $address = $data['address'] ?? null;
    $county_id = $data['county_id'] ?? null;
    
    if (!$name || !$county_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Name and county_id are required']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("UPDATE warehouses SET name = ?, address = ?, county_id = ? WHERE id = ?");
        $stmt->execute([$name, $address, $county_id, $id]);
        
        echo json_encode(['success' => true, 'message' => 'Warehouse updated successfully']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
}

function handleDeleteWarehouse($id) {
    global $pdo;
    
    if (!isAdmin()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Unauthorized access']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("DELETE FROM warehouses WHERE id = ?");
        $stmt->execute([$id]);
        
        echo json_encode(['success' => true, 'message' => 'Warehouse deleted successfully']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
}

function handleGetAdminPickupLocations() {
    global $pdo;
    
    if (!isAdmin()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Unauthorized access']);
        return;
    }
    
    try {
        $stmt = $pdo->query("SELECT p.*, w.name as warehouse_name, c.county_name 
                            FROM pickup_locations p 
                            JOIN warehouses w ON p.warehouse_id = w.id 
                            JOIN counties c ON p.county_id = c.county_id 
                            ORDER BY c.county_name ASC, p.name ASC");
        $locations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'data' => $locations]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
}

function handleCreatePickupLocation() {
    global $pdo;
    
    if (!isAdmin()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Unauthorized access']);
        return;
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $name = $data['name'] ?? null;
    $address = $data['address'] ?? null;
    $warehouse_id = $data['warehouse_id'] ?? null;
    $county_id = $data['county_id'] ?? null;
    
    if (!$name || !$warehouse_id || !$county_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Name, warehouse_id, and county_id are required']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("INSERT INTO pickup_locations (name, address, warehouse_id, county_id) VALUES (?, ?, ?, ?)");
        $stmt->execute([$name, $address, $warehouse_id, $county_id]);
        
        echo json_encode(['success' => true, 'message' => 'Pickup location created successfully', 'id' => $pdo->lastInsertId()]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
}

function handleUpdatePickupLocation($id) {
    global $pdo;
    
    if (!isAdmin()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Unauthorized access']);
        return;
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $name = $data['name'] ?? null;
    $address = $data['address'] ?? null;
    $warehouse_id = $data['warehouse_id'] ?? null;
    $county_id = $data['county_id'] ?? null;
    
    if (!$name || !$warehouse_id || !$county_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Name, warehouse_id, and county_id are required']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("UPDATE pickup_locations SET name = ?, address = ?, warehouse_id = ?, county_id = ? WHERE id = ?");
        $stmt->execute([$name, $address, $warehouse_id, $county_id, $id]);
        
        echo json_encode(['success' => true, 'message' => 'Pickup location updated successfully']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
}

function handleDeletePickupLocation($id) {
    global $pdo;
    
    if (!isAdmin()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Unauthorized access']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("DELETE FROM pickup_locations WHERE id = ?");
        $stmt->execute([$id]);
        
        echo json_encode(['success' => true, 'message' => 'Pickup location deleted successfully']);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Public endpoints for customers and vendors

function handleGetPublicWarehousesByCounty($county_id) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("SELECT id, name, address FROM warehouses WHERE county_id = ? ORDER BY name ASC");
        $stmt->execute([$county_id]);
        $warehouses = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'data' => $warehouses]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
}

function handleGetPublicPickupLocationsByCounty($county_id) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("SELECT id, name, address, warehouse_id FROM pickup_locations WHERE county_id = ? ORDER BY name ASC");
        $stmt->execute([$county_id]);
        $locations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'data' => $locations]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
    }
}
