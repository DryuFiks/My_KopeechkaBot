@echo off
cd /d "%~dp0"

:restart
echo.
echo Starting Kopeechka Bot...

call npm start
set "EXIT_CODE=%ERRORLEVEL%"

if "%EXIT_CODE%"=="75" (
    echo.
    echo Restart requested. Restarting in 2 seconds...
    timeout /t 2 /nobreak >nul
    goto restart
)

echo.
echo Bot stopped with exit code %EXIT_CODE%.
pause