$ErrorActionPreference = "Stop"
$pluginsRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\plugins")).Path

function Invoke-PluginBuild {
    param(
        [string]$Name,
        [scriptblock]$Build
    )
    Write-Host "`n=== Building $Name ===" -ForegroundColor Cyan
    Push-Location (Join-Path $pluginsRoot $Name)
    try {
        & $Build
        if ($LASTEXITCODE -ne 0) { throw "Build failed for $Name (exit $LASTEXITCODE)" }
    }
    finally {
        Pop-Location
    }
}

Invoke-PluginBuild "obsidian-style-settings" {
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
}

Invoke-PluginBuild "tasks-map" {
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
}

Invoke-PluginBuild "obsidian-tasks" {
    npm install --legacy-peer-deps --ignore-scripts
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
}

Invoke-PluginBuild "dataview" {
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
    $pluginDir = Get-Location
    $builtMain = Join-Path $pluginDir "build\main.js"
    if (Test-Path $builtMain) {
        Copy-Item -Force $builtMain (Join-Path $pluginDir "main.js")
        Write-Host "Copied build/main.js -> main.js" -ForegroundColor DarkGray
    }
}

Invoke-PluginBuild "obsidian-color-palette" {
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
}

Invoke-PluginBuild "obsidian-code-suite" {
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
    $pluginDir = Get-Location
    $builtMain = Join-Path $pluginDir "dist\main.js"
    if (Test-Path $builtMain) {
        Copy-Item -Force $builtMain (Join-Path $pluginDir "main.js")
        Write-Host "Copied dist/main.js -> main.js" -ForegroundColor DarkGray
    }
}


Invoke-PluginBuild "obsidian-creases" {
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
}

Invoke-PluginBuild "obsidian-people-graph" {
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
}

Invoke-PluginBuild "obsidian-cybria-core" {
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
}

Invoke-PluginBuild "obsidian-pixode" {
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
}

Invoke-PluginBuild "obsidian-cote-studio" {
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
    $pluginDir = Get-Location
    $replChunk = Join-Path $pluginDir "repl-chunk.js"
    if (-not (Test-Path $replChunk)) {
        throw "obsidian-cote-studio build missing repl-chunk.js (required when Full Strudel REPL is enabled)"
    }
    Write-Host "Verified main.js + repl-chunk.js" -ForegroundColor DarkGray
}
Write-Host "`nAll plugins built successfully." -ForegroundColor Green


