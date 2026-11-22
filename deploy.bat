@echo off
setlocal
cd /d "%~dp0"
set NODE_OPTIONS=--require ./shim-hostname.js
if "%VERCEL_TOKEN%"=="" (
  echo [sard] VERCEL_TOKEN not set.
  echo Set it once:  setx VERCEL_TOKEN "your_token_here"
  echo Then close and reopen this window.
  exit /b 1
)
echo [sard] Deploying to production...
call npx vercel@latest deploy --prod --yes --token=%VERCEL_TOKEN%
endlocal
