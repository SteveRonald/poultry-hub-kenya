<?php
// Fallback .env parsing in case environment variables are not populated
if (!function_exists('parseEnvFile')) {
    function parseEnvFile($path) {
        if (!file_exists($path)) {
            return [];
        }
        $values = [];
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0) {
                continue;
            }
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);
                if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
                    (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
                    $value = substr($value, 1, -1);
                }
                $values[$key] = $value;
            }
        }
        return $values;
    }
}
