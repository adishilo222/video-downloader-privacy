@echo off
REM Script to package Chrome Extension for Chrome Web Store submission (Windows)
REM This creates a ZIP file excluding development files

set EXTENSION_NAME=Video Downloader
set ZIP_NAME=video-downloader-extension.zip
set TEMP_DIR=temp_package

echo Packaging Chrome Extension for Store Submission...
echo.

REM Check if required files exist
echo Checking required files...

if not exist "manifest.json" (
    echo Error: manifest.json is missing!
    exit /b 1
)
if not exist "popup.html" (
    echo Error: popup.html is missing!
    exit /b 1
)
if not exist "popup.js" (
    echo Error: popup.js is missing!
    exit /b 1
)
if not exist "popup.css" (
    echo Error: popup.css is missing!
    exit /b 1
)
if not exist "content.js" (
    echo Error: content.js is missing!
    exit /b 1
)

REM Check if icons exist
if not exist "icons" (
    echo Warning: Icons folder is missing!
    echo You need to add icon16.png, icon48.png, and icon128.png to the icons folder.
    pause
) else (
    if not exist "icons\icon16.png" (
        echo Warning: icon16.png is missing!
    )
    if not exist "icons\icon48.png" (
        echo Warning: icon48.png is missing!
    )
    if not exist "icons\icon128.png" (
        echo Warning: icon128.png is missing!
    )
)

REM Remove old package if exists
if exist "%ZIP_NAME%" (
    echo Removing old package...
    del "%ZIP_NAME%"
)

REM Create temporary directory
if exist "%TEMP_DIR%" (
    rmdir /s /q "%TEMP_DIR%"
)
mkdir "%TEMP_DIR%"

REM Copy required files
echo Copying extension files...
copy manifest.json "%TEMP_DIR%\" >nul
copy popup.html "%TEMP_DIR%\" >nul
copy popup.js "%TEMP_DIR%\" >nul
copy popup.css "%TEMP_DIR%\" >nul
copy content.js "%TEMP_DIR%\" >nul

REM Copy icons folder if it exists
if exist "icons" (
    xcopy /E /I /Y icons "%TEMP_DIR%\icons" >nul
)

REM Create ZIP file using PowerShell
echo Creating ZIP archive...
powershell -Command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%ZIP_NAME%' -Force"

REM Clean up
rmdir /s /q "%TEMP_DIR%"

REM Check if ZIP was created successfully
if exist "%ZIP_NAME%" (
    echo.
    echo Package created successfully!
    echo   File: %ZIP_NAME%
    echo.
    echo Next steps:
    echo   1. Review the ZIP file contents
    echo   2. Upload to Chrome Web Store Developer Dashboard
    echo   3. Complete store listing information
) else (
    echo Error: Failed to create package
    exit /b 1
)

pause

