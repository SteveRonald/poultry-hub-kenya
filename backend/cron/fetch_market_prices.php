<?php
/**
 * Cron Job: Fetch Market Prices from KAMIS and Vendor Platform
 * Run this daily or weekly (e.g., daily at 2 AM)
 * 
 * This script fetches market data from:
 * 1. Vendor Platform (primary source - real transaction prices)
 * 2. KAMIS (secondary source - official government data)
 * 
 * Usage (Windows Task Scheduler or cron):
 * php backend/cron/fetch_market_prices.php
 */

// Set working directory to project root
chdir(__DIR__ . '/..');

// Include and run the combined fetch script
// This will aggregate vendor prices and scrape KAMIS data
require_once __DIR__ . '/../scripts/fetch_all_market_data.php';

