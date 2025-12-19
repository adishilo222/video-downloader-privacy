#!/bin/bash

# Script to package Chrome Extension for Chrome Web Store submission
# This creates a ZIP file excluding development files

EXTENSION_NAME="Video Downloader"
ZIP_NAME="video-downloader-extension.zip"
TEMP_DIR="temp_package"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Packaging Chrome Extension for Store Submission...${NC}\n"

# Check if required files exist
echo "Checking required files..."

REQUIRED_FILES=("manifest.json" "popup.html" "popup.js" "popup.css" "content.js")
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -ne 0 ]; then
    echo -e "${RED}Error: Missing required files:${NC}"
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    exit 1
fi

# Check if icons exist
if [ ! -d "icons" ] || [ -z "$(ls -A icons 2>/dev/null)" ]; then
    echo -e "${YELLOW}Warning: Icons folder is empty or missing!${NC}"
    echo "You need to add icon16.png, icon48.png, and icon128.png to the icons folder."
    echo "Press Ctrl+C to cancel, or Enter to continue anyway..."
    read
fi

# Remove old package if exists
if [ -f "$ZIP_NAME" ]; then
    echo "Removing old package..."
    rm "$ZIP_NAME"
fi

# Create temporary directory
mkdir -p "$TEMP_DIR"

# Copy required files
echo "Copying extension files..."
cp manifest.json "$TEMP_DIR/"
cp popup.html "$TEMP_DIR/"
cp popup.js "$TEMP_DIR/"
cp popup.css "$TEMP_DIR/"
cp content.js "$TEMP_DIR/"

# Copy icons folder if it exists
if [ -d "icons" ]; then
    cp -r icons "$TEMP_DIR/"
fi

# Create ZIP file
echo "Creating ZIP archive..."
cd "$TEMP_DIR"
zip -r "../$ZIP_NAME" . -x "*.DS_Store" "*.git*" > /dev/null
cd ..

# Clean up
rm -rf "$TEMP_DIR"

# Check if ZIP was created successfully
if [ -f "$ZIP_NAME" ]; then
    SIZE=$(du -h "$ZIP_NAME" | cut -f1)
    echo -e "\n${GREEN}✓ Package created successfully!${NC}"
    echo -e "  File: ${GREEN}$ZIP_NAME${NC}"
    echo -e "  Size: ${GREEN}$SIZE${NC}"
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo "  1. Review the ZIP file contents"
    echo "  2. Upload to Chrome Web Store Developer Dashboard"
    echo "  3. Complete store listing information"
else
    echo -e "${RED}Error: Failed to create package${NC}"
    exit 1
fi

