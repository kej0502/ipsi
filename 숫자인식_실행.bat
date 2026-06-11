@echo off
chcp 65001 > nul
title Handwritten Digit Recognizer
cd /d "%~dp0"

echo ============================================
echo   Handwritten Digit Recognizer
echo ============================================
echo.

python digit_recognizer.py

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] An error occurred. Check the message above.
    pause
)
