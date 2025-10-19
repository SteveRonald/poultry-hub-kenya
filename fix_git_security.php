<?php
// Simple script to fix Git security issues

echo "Fixing Git security issues...\n";

// Check if .env file exists
if (file_exists('backend/.env')) {
    echo "✅ .env file exists and will be kept locally\n";
} else {
    echo "❌ .env file not found\n";
}

// Check if google_drive_tokens.json exists
if (file_exists('backend/config/google_drive_tokens.json')) {
    echo "❌ google_drive_tokens.json still exists\n";
} else {
    echo "✅ google_drive_tokens.json removed\n";
}

// Check .gitignore
$gitignore = file_get_contents('.gitignore');
if (strpos($gitignore, 'backend/.env') !== false) {
    echo "✅ .env file is in .gitignore\n";
} else {
    echo "❌ .env file not in .gitignore\n";
}

echo "\nTo fix the GitHub push issue, run these commands:\n";
echo "1. git add .\n";
echo "2. git commit -m 'Remove sensitive files from repository'\n";
echo "3. git push origin main\n";
?>
