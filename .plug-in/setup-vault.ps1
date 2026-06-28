# Links local theme/plugin sources into the Project Cybria vault for development.
# Re-run after cloning the repo or if links are broken.

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$vaultObsidian = Join-Path $repoRoot ".vault\Project Cybria\.obsidian"
$themeSrc = Join-Path $repoRoot ".plug-in\transparent-style"
$pluginSrc = Join-Path $repoRoot ".plug-in\base-style"
$themeLink = Join-Path $vaultObsidian "themes\Transparent"
$pluginLink = Join-Path $vaultObsidian "plugins\obsidian-style-settings"

function Ensure-Junction([string]$Link, [string]$Target) {
    if (-not (Test-Path $Target)) {
        throw "Source not found: $Target"
    }
    $parent = Split-Path $Link -Parent
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    if (Test-Path $Link) {
        Remove-Item -Force -Recurse $Link
    }
    cmd /c mklink /J "`"$Link`"" "`"$Target`"" | Out-Null
    Write-Host "Linked: $Link -> $Target"
}

Write-Host "Building Style Settings plugin..."
Push-Location $pluginSrc
try {
    if (-not (Test-Path "node_modules")) {
        npm install
    }
    npm run build
}
finally {
    Pop-Location
}

Ensure-Junction $themeLink $themeSrc
Ensure-Junction $pluginLink $pluginSrc

$communityPlugins = Join-Path $vaultObsidian "community-plugins.json"
if (-not (Test-Path $communityPlugins)) {
    @'
[
  "obsidian-style-settings"
]
'@ | Set-Content -Path $communityPlugins -Encoding UTF8
}

$appearance = Join-Path $vaultObsidian "appearance.json"
if (-not (Test-Path $appearance) -or (Get-Content $appearance -Raw).Trim() -eq "{}") {
    @'
{
  "cssTheme": "Transparent",
  "theme": "obsidian",
  "accentColor": "",
  "enabledCssSnippets": []
}
'@ | Set-Content -Path $appearance -Encoding UTF8
}

Write-Host ""
Write-Host "Vault dev setup complete."
Write-Host "Open vault: $repoRoot\.vault\Project Cybria"
Write-Host "Edit theme:  $themeSrc\theme.css"
Write-Host "Edit plugin: $pluginSrc\src\"
Write-Host "After plugin changes: npm run build (in base-style), then reload Obsidian."
