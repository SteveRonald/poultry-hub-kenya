# Fix Vite Cache Issues
# This script clears Vite cache to fix common issues like:
# - MIME type errors
# - Stale module cache
# - Build inconsistencies
# - HMR (Hot Module Replacement) issues

Write-Host "Fixing Vite cache issues..." -ForegroundColor Yellow
Write-Host ""

$cleared = $false

# Remove Vite cache directory in node_modules
if (Test-Path "node_modules\.vite") {
    Remove-Item -Recurse -Force "node_modules\.vite"
    Write-Host "✓ Vite cache cleared: node_modules\.vite" -ForegroundColor Green
    $cleared = $true
}

# Remove Vite cache in root and frontend (if exists)
$viteCaches = @(".vite", "frontend\\.vite")
foreach ($cachePath in $viteCaches) {
    if (Test-Path $cachePath) {
        Remove-Item -Recurse -Force $cachePath
        Write-Host "✓ Vite cache cleared: $cachePath" -ForegroundColor Green
        $cleared = $true
    }
}

# Clear dist folders if they exist (root and frontend)
$distPaths = @("dist", "frontend\\dist")
foreach ($distPath in $distPaths) {
    if (Test-Path $distPath) {
        Remove-Item -Recurse -Force $distPath
        Write-Host "✓ Dist folder cleared: $distPath" -ForegroundColor Green
        $cleared = $true
    }
}

Write-Host ""
if ($cleared) {
    Write-Host "✓ Cache cleared successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Restart your dev server: npm run dev" -ForegroundColor White
    Write-Host "2. Clear your browser cache:" -ForegroundColor White
    Write-Host "   - Press Ctrl+Shift+Delete" -ForegroundColor Gray
    Write-Host "   - Or do a hard refresh: Ctrl+F5 or Ctrl+Shift+R" -ForegroundColor Gray
    Write-Host ""
    Write-Host "This should fix MIME type errors and other cache-related issues." -ForegroundColor Green
} else {
    Write-Host "No cache found to clear." -ForegroundColor Yellow
}
Write-Host ""

