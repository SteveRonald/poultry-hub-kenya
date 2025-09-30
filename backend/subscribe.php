<?php

// Include database connection
require_once 'db_connect.php';

// Set response header
header('Content-Type: application/json');

// Check if the request method is POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get the input data
    $data = json_decode(file_get_contents('php://input'), true);

    // Validate email
    if (isset($data['email']) && filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $email = $data['email'];

        // Prepare SQL query
        $stmt = $conn->prepare("INSERT INTO newsletter_subscribers (email) VALUES (?)");
        $stmt->bind_param("s", $email);

        // Execute query
        if ($stmt->execute()) {
            echo json_encode(["message" => "Subscription successful."]);
        } else {
            echo json_encode(["message" => "Failed to subscribe."]);
        }

        $stmt->close();
    } else {
        echo json_encode(["message" => "Invalid email address."]);
    }
} else {
    echo json_encode(["message" => "Invalid request method."]);
}

$conn->close();

?>