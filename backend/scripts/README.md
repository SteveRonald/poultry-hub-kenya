# Market Insights Scripts

This folder contains scripts for collecting market data and generating price predictions.

## Production Scripts

### 1. `fetch_all_market_data.php`
**Orchestrator script** that runs both data collection scripts.
- Called by: `backend/cron/fetch_market_prices.php`
- Runs: `aggregate_vendor_prices.php` and `scrape_kamis_prices.php`
- Frequency: Daily/Weekly via cron

### 2. `aggregate_vendor_prices.php`
Aggregates market prices from vendor platform product listings.
- Source: Vendor platform database
- Updates: `market_prices` table
- Frequency: Daily/Weekly

### 3. `scrape_kamis_prices.php`
Scrapes official poultry prices from KAMIS (Kenya Agricultural Market Information System).
- Source: https://kamis.kilimo.go.ke
- Updates: `market_prices` table
- Frequency: Weekly (KAMIS updates weekly)
- Dependencies: Uses `kamis_sample.html` for testing

### 4. `predict_prices.py`
Generates price predictions using Prophet + ARIMA ensemble models.
- Called by: `backend/cron/run_predictions_secure.php`
- Updates: `predicted_prices` table
- Frequency: Daily via cron
- Requirements: Python 3.8+, pandas, prophet, statsmodels, mysql-connector-python

### 5. `kamis_sample.html`
Sample HTML file used for testing/development of KAMIS scraper.
- Used by: `scrape_kamis_prices.php`
- Purpose: Testing HTML parsing logic

## Usage

### Run Data Collection (Vendor + KAMIS)
```bash
php backend/scripts/fetch_all_market_data.php
```

### Run Predictions
```bash
python backend/scripts/predict_prices.py
```

### Via Cron Jobs
- Data collection: `php backend/cron/fetch_market_prices.php`
- Predictions: `php backend/cron/generate_predictions.php`

## Notes

- All scripts update `market_insights_metadata` table with timestamps
- Scripts use prepared statements for database operations
- Error handling and logging are included in all scripts
- Scripts are designed to be idempotent (safe to run multiple times)

