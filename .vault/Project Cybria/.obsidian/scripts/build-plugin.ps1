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


Invoke-PluginBuild "obsidian-local-llm-hub" {
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
}

Invoke-PluginBuild "obsidian-enzyme" {
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        bun install
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        bun run build
    } else {
        npm install
        if ($LASTEXITCODE -ne 0) {
            npm install --legacy-peer-deps
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
        npm run build
    }
}

Invoke-PluginBuild "obsidian-color-palette" {
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
}

Invoke-PluginBuild "obsidian-agent" {
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

Invoke-PluginBuild "obsidian-storyteller-suite" {
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
}

Invoke-PluginBuild "obsidian-image-gen" {
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run build
}
Write-Host "`nAll plugins built successfully." -ForegroundColor Green


