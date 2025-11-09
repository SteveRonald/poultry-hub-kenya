# Clear Vite cache and node_modules/.vite
Write-Host "Clearing Vite cache..." -ForegroundColor Yellow

$viteCachePath = "node_modules\.vite"
if (Test-Path $viteCachePath) {
    Remove-Item -Recurse -Force $viteCachePath
    Write-Host "✓ Vite cache cleared: $viteCachePath" -ForegroundColor Green
} else {
    Write-Host "No Vite cache found." -ForegroundColor Gray
}

# Also clear any dist folder
$distPath = "dist"
if (Test-Path $distPath) {
    Remove-Item -Recurse -Force $distPath
    Write-Host "✓ Dist folder cleared: $distPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "Cache cleared! Now:" -ForegroundColor Cyan
Write-Host "1. Stop your dev server (Ctrl+C if running)" -ForegroundColor White
Write-Host "2. Restart it with: npm run dev" -ForegroundColor White
Write-Host "3. Hard refresh your browser: Ctrl+Shift+R" -ForegroundColor White

