<?php
/**
 * Cron Job: Generate Price Predictions (Secure)
 * Run this daily (e.g., every day at 3 AM)
 * 
 * This script uses the secure prediction runner which includes:
 * - API key authentication
 * - Rate limiting
 * - Comprehensive logging
 * - Error handling
 * 
 * Usage (Windows Task Scheduler or cron):
 * php backend/cron/generate_predictions.php
 * 
 * For manual execution with API key:
 * php backend/cron/run_predictions_secure.php --api-key=YOUR_API_KEY
 */

// Set working directory
chdir(__DIR__ . '/..');

// Use the secure prediction runner
require_once __DIR__ . '/run_predictions_secure.php';

