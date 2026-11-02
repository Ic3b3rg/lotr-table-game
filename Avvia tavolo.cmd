@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Installa Node.js 24 LTS e segui la preparazione nel README.
  pause
  exit /b 1
)
if not exist dist\host.mjs (
  echo Prima prepara il tavolo: npm ci --ignore-scripts e npm run build.
  pause
  exit /b 1
)
node dist\host.mjs
pause
