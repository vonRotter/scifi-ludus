@echo off
cd /d "%~dp0"

echo Checking dependencies...
if not exist node_modules (
    call npm install
    if errorlevel 1 (
        echo.
        echo Something went wrong installing dependencies. Make sure Node.js is installed: https://nodejs.org/
        pause
        exit /b 1
    )
)

echo Starting LUDUS...
start "" http://localhost:5173/
call npm run dev

pause
