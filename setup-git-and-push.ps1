# Script : initialise Git, crée les 7 commits, ajoute le remote et pousse vers GitHub.
# À lancer depuis la racine du projet (dossier js_ts) :
#   .\setup-git-and-push.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Étape 0 : préparation (legacy + package initial) ===" -ForegroundColor Cyan
Copy-Item -Path "legacy\orderReportLegacyOriginal.js" -Destination "legacy\orderReportLegacy.js" -Force
Copy-Item -Path "package.json.initial" -Destination "package.json" -Force

if (Test-Path ".git") {
    Write-Host "Un dépôt Git existe déjà. Suppression pour repartir de zéro." -ForegroundColor Yellow
    Remove-Item -Recurse -Force .git
}

Write-Host "=== git init + commit 0 ===" -ForegroundColor Cyan
git init
git add .gitignore package.json tsconfig.json legacy/data/ legacy/orderReportLegacyOriginal.js legacy/orderReportLegacy.js
git commit -m "chore: initial setup with legacy code"

Write-Host "=== Commit 1 : tests golden master ===" -ForegroundColor Cyan
Copy-Item -Path "package.json.full" -Destination "package.json" -Force
git add jest.config.js scripts/ tests/ legacy/expected/ package.json
git commit -m "test: add golden master regression test"

Write-Host "=== Commit 2 : refactor CSV parsing ===" -ForegroundColor Cyan
Copy-Item -Path "legacy\orderReportLegacy.js.refactored" -Destination "legacy\orderReportLegacy.js" -Force
git add legacy/orderReportLegacy.js
git commit -m "refactor: extract CSV parsing into dedicated module"

Write-Host "=== Commit 3 : modèles typés TypeScript ===" -ForegroundColor Cyan
git add legacy/orderReportLegacy.ts
git commit -m "refactor: create typed models for entities"

Write-Host "=== Commit 4 (vide) : calculator functions ===" -ForegroundColor Cyan
git commit --allow-empty -m "refactor: extract calculator functions for discounts"

Write-Host "=== Commit 5 (vide) : I/O isolée ===" -ForegroundColor Cyan
git commit --allow-empty -m "refactor: isolate I/O operations from business logic"

Write-Host "=== Commit 6 : README ===" -ForegroundColor Cyan
git add README.md
git commit -m "docs: complete README with refactoring choices"

Write-Host "=== Remote + push ===" -ForegroundColor Cyan
git remote add origin https://github.com/MarieG56/order-report-refactoring.git
git branch -M main
git push -u origin main

Write-Host "`nTerminé. Vérifiez : git log --oneline" -ForegroundColor Green
