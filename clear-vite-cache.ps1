# Clear Vite cache and build artifacts
# This script clears Vite's cache directory and the dist folder
# Use this when experiencing caching issues or build problems

Write-Host "Clearing Vite cache..." -ForegroundColor Yellow
Write-Host ""

$cleared = $false

# Clear Vite cache in node_modules/.vite
$viteCachePath = "node_modules\.vite"
if (Test-Path $viteCachePath) {
    Remove-Item -Recurse -Force $viteCachePath
    Write-Host "✓ Vite cache cleared: $viteCachePath" -ForegroundColor Green
    $cleared = $true
} else {
    Write-Host "  No Vite cache found in node_modules/.vite" -ForegroundColor Gray
}

# Clear Vite cache in .vite (root directory, if exists)
$rootViteCache = ".vite"
if (Test-Path $rootViteCache) {
    Remove-Item -Recurse -Force $rootViteCache
    Write-Host "✓ Vite cache cleared: $rootViteCache" -ForegroundColor Green
    $cleared = $true
}

# Clear dist folder
$distPath = "dist"
if (Test-Path $distPath) {
    Remove-Item -Recurse -Force $distPath
    Write-Host "✓ Dist folder cleared: $distPath" -ForegroundColor Green
    $cleared = $true
} else {
    Write-Host "  No dist folder found" -ForegroundColor Gray
}

Write-Host ""
if ($cleared) {
    Write-Host "✓ Cache cleared successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Stop your dev server (Ctrl+C if running)" -ForegroundColor White
    Write-Host "2. Restart it with: npm run dev" -ForegroundColor White
    Write-Host "3. Hard refresh your browser: Ctrl+Shift+R or Ctrl+F5" -ForegroundColor White
} else {
    Write-Host "No cache found to clear." -ForegroundColor Yellow
}
Write-Host ""

