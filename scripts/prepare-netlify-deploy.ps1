$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outDir = Join-Path $projectRoot "netlify-dist"

if (Test-Path $outDir) {
    Remove-Item $outDir -Recurse -Force
}

New-Item -ItemType Directory -Path $outDir | Out-Null

# Copy all root HTML and XML content pages.
Get-ChildItem -Path $projectRoot -File | Where-Object {
    $_.Extension -in @('.html', '.xml', '.webmanifest')
} | ForEach-Object {
    Copy-Item $_.FullName -Destination (Join-Path $outDir $_.Name) -Force
}

# Copy Netlify and PWA root files used by production hosting.
$rootFiles = @(
    "_headers",
    "_redirects",
    "manifest.json",
    "service-worker.js"
)

foreach ($file in $rootFiles) {
    $source = Join-Path $projectRoot $file
    if (Test-Path $source) {
        Copy-Item $source -Destination (Join-Path $outDir $file) -Force
    }
}

# Copy static asset folders needed by the website.
$assetDirs = @("css", "js", "images", "data", "pizzerior")

foreach ($dir in $assetDirs) {
    $source = Join-Path $projectRoot $dir
    if (Test-Path $source) {
        Copy-Item $source -Destination (Join-Path $outDir $dir) -Recurse -Force
    }
}

Write-Host "Prepared Netlify deploy folder: $outDir"
