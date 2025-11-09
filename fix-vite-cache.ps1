# Fix Vite MIME Type Issues
Write-Host "Clearing Vite cache..." -ForegroundColor Yellow

# Remove Vite cache directory
if (Test-Path "node_modules\.vite") {
    Remove-Item -Recurse -Force "node_modules\.vite"
    Write-Host "Vite cache cleared!" -ForegroundColor Green
} else {
    Write-Host "No Vite cache found." -ForegroundColor Gray
}

# Clear dist folder if it exists
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "Dist folder cleared!" -ForegroundColor Green
}

Write-Host "`nPlease restart your dev server with: npm run dev" -ForegroundColor Cyan
Write-Host "And clear your browser cache (Ctrl+Shift+Delete) or do a hard refresh (Ctrl+F5)" -ForegroundColor Cyan

