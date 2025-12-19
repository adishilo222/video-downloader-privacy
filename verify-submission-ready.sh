#!/bin/bash

# Script to verify extension is ready for Chrome Web Store submission

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Chrome Web Store Submission Readiness Check${NC}\n"
echo "=========================================="

ERRORS=0
WARNINGS=0

# Check required files
echo -e "\n${BLUE}Checking required files...${NC}"
REQUIRED_FILES=("manifest.json" "popup.html" "popup.js" "popup.css" "content.js")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file (MISSING)"
        ((ERRORS++))
    fi
done

# Check icons
echo -e "\n${BLUE}Checking icons...${NC}"
ICON_SIZES=(16 48 128)
for size in "${ICON_SIZES[@]}"; do
    icon_file="icons/icon${size}.png"
    if [ -f "$icon_file" ]; then
        # Check if file is not empty
        if [ -s "$icon_file" ]; then
            echo -e "  ${GREEN}✓${NC} $icon_file"
        else
            echo -e "  ${RED}✗${NC} $icon_file (EMPTY)"
            ((ERRORS++))
        fi
    else
        echo -e "  ${RED}✗${NC} $icon_file (MISSING)"
        ((ERRORS++))
    fi
done

# Check manifest.json
echo -e "\n${BLUE}Checking manifest.json...${NC}"
if [ -f "manifest.json" ]; then
    # Check for required fields
    if grep -q '"manifest_version"' manifest.json; then
        echo -e "  ${GREEN}✓${NC} manifest_version present"
    else
        echo -e "  ${RED}✗${NC} manifest_version missing"
        ((ERRORS++))
    fi
    
    if grep -q '"name"' manifest.json; then
        echo -e "  ${GREEN}✓${NC} name present"
    else
        echo -e "  ${RED}✗${NC} name missing"
        ((ERRORS++))
    fi
    
    if grep -q '"version"' manifest.json; then
        echo -e "  ${GREEN}✓${NC} version present"
    else
        echo -e "  ${RED}✗${NC} version missing"
        ((ERRORS++))
    fi
    
    # Check manifest version
    if grep -q '"manifest_version": 3' manifest.json; then
        echo -e "  ${GREEN}✓${NC} Using Manifest V3 (required)"
    else
        echo -e "  ${YELLOW}⚠${NC} Not using Manifest V3"
        ((WARNINGS++))
    fi
fi

# Check for packaging
echo -e "\n${BLUE}Checking package...${NC}"
if [ -f "video-downloader-extension.zip" ]; then
    SIZE=$(du -h "video-downloader-extension.zip" | cut -f1)
    echo -e "  ${GREEN}✓${NC} Package ZIP exists ($SIZE)"
    
    # Verify ZIP contents
    if unzip -l "video-downloader-extension.zip" | grep -q "manifest.json"; then
        echo -e "  ${GREEN}✓${NC} ZIP contains manifest.json"
    else
        echo -e "  ${RED}✗${NC} ZIP missing manifest.json"
        ((ERRORS++))
    fi
else
    echo -e "  ${YELLOW}⚠${NC} Package ZIP not found (run ./package-extension.sh)"
    ((WARNINGS++))
fi

# Check privacy policy
echo -e "\n${BLUE}Checking privacy policy...${NC}"
if [ -f "privacy-policy.html" ]; then
    echo -e "  ${GREEN}✓${NC} privacy-policy.html exists"
    echo -e "  ${YELLOW}⚠${NC} Remember to host this file and get a public URL"
    ((WARNINGS++))
else
    echo -e "  ${RED}✗${NC} privacy-policy.html missing"
    ((ERRORS++))
fi

# Check documentation
echo -e "\n${BLUE}Checking documentation...${NC}"
DOC_FILES=("SUBMISSION_GUIDE.md" "STORE_LISTING_TEMPLATE.md" "SUBMISSION_CHECKLIST.md")
for doc in "${DOC_FILES[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "  ${GREEN}✓${NC} $doc"
    else
        echo -e "  ${YELLOW}⚠${NC} $doc missing (helpful but not required)"
    fi
done

# Summary
echo -e "\n=========================================="
echo -e "${BLUE}Summary:${NC}\n"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ Extension is ready for submission!${NC}"
    echo -e "\nNext steps:"
    echo "  1. Host privacy-policy.html and get the URL"
    echo "  2. Create Chrome Web Store Developer account ($5)"
    echo "  3. Upload video-downloader-extension.zip"
    echo "  4. Fill out store listing using STORE_LISTING_TEMPLATE.md"
    echo "  5. Submit for review"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Extension has $WARNINGS warning(s) but is mostly ready${NC}"
    echo -e "\nAddress warnings before submission for best results."
else
    echo -e "${RED}✗ Extension has $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo -e "\nPlease fix errors before submitting."
fi

echo ""
exit $ERRORS

