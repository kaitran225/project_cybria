$plugin = Join-Path $PSScriptRoot "..\.vault\Project Cybria\.obsidian\plugins\obsidian-style-settings"
Push-Location $plugin
try {
    if (-not (Test-Path "node_modules")) { npm install }
    npm run build
    Write-Host "Plugin built: $plugin\main.js"
}
finally {
    Pop-Location
}
