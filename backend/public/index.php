<?php
// Render deployment entry point
// This file serves as the public entry point for the PHP backend

// Set error reporting for production
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Include the main application
require_once __DIR__ . '/../index.php';
?>
