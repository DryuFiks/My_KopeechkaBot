@echo off
setlocal
:run
echo Starting Kopeechka Bot...
npm start
if errorlevel 75 (
  echo Restart requested. Starting again in 2 seconds...
  timeout /t 2 /nobreak >nul
  goto run
)
echo Bot stopped.
