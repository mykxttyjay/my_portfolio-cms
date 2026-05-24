# Set PATH to use Node v22.22.3 from fnm
$env:PATH = "$env:APPDATA\fnm\node-versions\v22.22.3\installation;$env:PATH"

# Verify Node version
Write-Host "Using Node version:" -ForegroundColor Green
node --version

# Run dev server
Write-Host "Starting dev server..." -ForegroundColor Cyan
bun run dev
