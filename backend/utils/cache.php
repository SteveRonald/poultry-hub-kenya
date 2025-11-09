<?php
/**
 * Simple in-memory cache for location data
 * This cache persists for the duration of the PHP process
 * For production, consider using Redis or Memcached
 */

class SimpleCache {
    private static $cache = [];
    private static $ttl = 3600; // 1 hour default TTL
    
    /**
     * Get a value from cache
     */
    public static function get($key) {
        if (!isset(self::$cache[$key])) {
            return null;
        }
        
        $item = self::$cache[$key];
        
        // Check if expired
        if (time() > $item['expires']) {
            unset(self::$cache[$key]);
            return null;
        }
        
        return $item['value'];
    }
    
    /**
     * Set a value in cache
     */
    public static function set($key, $value, $ttl = null) {
        $ttl = $ttl ?? self::$ttl;
        self::$cache[$key] = [
            'value' => $value,
            'expires' => time() + $ttl
        ];
    }
    
    /**
     * Check if a key exists and is not expired
     */
    public static function has($key) {
        if (!isset(self::$cache[$key])) {
            return false;
        }
        
        if (time() > self::$cache[$key]['expires']) {
            unset(self::$cache[$key]);
            return false;
        }
        
        return true;
    }
    
    /**
     * Clear a specific key
     */
    public static function forget($key) {
        unset(self::$cache[$key]);
    }
    
    /**
     * Clear all cache
     */
    public static function flush() {
        self::$cache = [];
    }
    
    /**
     * Get cache statistics
     */
    public static function stats() {
        return [
            'keys' => count(self::$cache),
            'memory' => memory_get_usage(true)
        ];
    }
}

