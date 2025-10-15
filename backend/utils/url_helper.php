<?php
/**
 * URL Helper Functions
 * Handles URL conversion for production deployment
 */

/**
 * Fix image URLs from localhost to production domain
 * @param string|null $url The image URL to fix
 * @return string|null The fixed URL or null if input is null
 */
function fixImageUrl($url) {
    if (!$url) return null;
    
    // Replace localhost URLs with production URL
    $url = str_replace('http://localhost/poultry-hub-kenya', 'https://poultryhubkenya.great-site.net', $url);
    $url = str_replace('http://127.0.0.1/poultry-hub-kenya', 'https://poultryhubkenya.great-site.net', $url);
    
    // Handle any other localhost variations (192.168.x.x, 10.x.x.x, etc.)
    $url = preg_replace('/http:\/\/[^\/]+\/poultry-hub-kenya/', 'https://poultryhubkenya.great-site.net', $url);
    
    return $url;
}

/**
 * Fix multiple image URLs in an array
 * @param array $urls Array of image URLs
 * @return array Array of fixed URLs
 */
function fixImageUrls($urls) {
    if (!is_array($urls)) return $urls;
    
    return array_map('fixImageUrl', $urls);
}

/**
 * Get the base URL for the current environment
 * @return string The base URL
 */
function getBaseUrl() {
    // Check if we're in production
    if (isset($_SERVER['HTTP_HOST']) && strpos($_SERVER['HTTP_HOST'], 'poultryhubkenya.great-site.net') !== false) {
        return 'https://poultryhubkenya.great-site.net';
    }
    
    // Development fallback
    return 'http://localhost/poultry-hub-kenya';
}
?>
