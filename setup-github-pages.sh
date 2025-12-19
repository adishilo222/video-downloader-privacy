#!/bin/bash

# Script to help set up GitHub Pages for privacy policy hosting
# This script provides step-by-step instructions and can create a local git repo

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}GitHub Pages Setup for Privacy Policy${NC}\n"

# Check if privacy-policy.html exists
if [ ! -f "privacy-policy.html" ]; then
    echo -e "${YELLOW}Error: privacy-policy.html not found!${NC}"
    exit 1
fi

echo -e "${GREEN}This script will help you set up GitHub Pages to host your privacy policy.${NC}\n"
echo "Choose an option:"
echo "  1) Create a new GitHub repository setup (local only)"
echo "  2) Show manual instructions"
echo "  3) Check if git is installed"
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo -e "\n${BLUE}Setting up local git repository...${NC}"
        
        # Check if git is installed
        if ! command -v git &> /dev/null; then
            echo -e "${YELLOW}Git is not installed. Please install git first.${NC}"
            exit 1
        fi
        
        # Check if already a git repo
        if [ -d ".git" ]; then
            echo -e "${YELLOW}This directory is already a git repository.${NC}"
            read -p "Do you want to create a separate directory for the privacy policy? (y/n): " create_dir
            if [ "$create_dir" = "y" ]; then
                mkdir -p ../video-downloader-privacy
                cd ../video-downloader-privacy
                git init
                cp ../"Chrome Extension for downloading videos"/privacy-policy.html .
                echo "Privacy policy copied to new directory."
            else
                echo "Using existing repository."
            fi
        else
            git init
            echo "Git repository initialized."
        fi
        
        # Create .gitignore
        cat > .gitignore << EOF
.DS_Store
*.zip
temp_package/
__pycache__/
*.pyc
EOF
        
        # Copy privacy policy if not in current directory
        if [ ! -f "privacy-policy.html" ]; then
            cp privacy-policy.html . 2>/dev/null || echo "Privacy policy already in place."
        fi
        
        # Create README for the repo
        cat > README.md << 'EOF'
# Video Downloader Extension - Privacy Policy

This repository hosts the privacy policy for the Video Downloader Chrome Extension.

## Privacy Policy

The privacy policy is available at: `privacy-policy.html`

Once GitHub Pages is enabled, it will be accessible at:
`https://[your-username].github.io/[repository-name]/privacy-policy.html`

## Setup Instructions

1. Push this repository to GitHub
2. Go to Settings → Pages
3. Select the main branch as source
4. Your privacy policy will be live at the URL shown above
EOF
        
        echo -e "\n${GREEN}✓ Local repository setup complete!${NC}\n"
        echo -e "${YELLOW}Next steps:${NC}"
        echo "  1. Create a new repository on GitHub (e.g., 'video-downloader-privacy')"
        echo "  2. Run these commands:"
        echo "     git add ."
        echo "     git commit -m 'Add privacy policy'"
        echo "     git branch -M main"
        echo "     git remote add origin https://github.com/YOUR_USERNAME/video-downloader-privacy.git"
        echo "     git push -u origin main"
        echo "  3. Go to GitHub repository → Settings → Pages"
        echo "  4. Select 'main' branch and '/ (root)' folder"
        echo "  5. Your privacy policy will be at:"
        echo "     https://YOUR_USERNAME.github.io/video-downloader-privacy/privacy-policy.html"
        ;;
    2)
        echo -e "\n${BLUE}Manual GitHub Pages Setup Instructions:${NC}\n"
        cat << 'EOF'
1. Create a GitHub account (if you don't have one):
   - Go to https://github.com
   - Sign up for a free account

2. Create a new repository:
   - Click the "+" icon → "New repository"
   - Name it: "video-downloader-privacy" (or any name you prefer)
   - Make it Public (required for free GitHub Pages)
   - Don't initialize with README
   - Click "Create repository"

3. Upload privacy-policy.html:
   - Click "uploading an existing file"
   - Drag and drop privacy-policy.html
   - Commit the file

4. Enable GitHub Pages:
   - Go to Settings → Pages (in your repository)
   - Under "Source", select "Deploy from a branch"
   - Select "main" branch and "/ (root)" folder
   - Click "Save"

5. Access your privacy policy:
   - Wait 1-2 minutes for GitHub to build the page
   - Your privacy policy will be at:
     https://YOUR_USERNAME.github.io/video-downloader-privacy/privacy-policy.html
   - Replace YOUR_USERNAME with your GitHub username

6. Use this URL in your Chrome Web Store listing!
EOF
        ;;
    3)
        if command -v git &> /dev/null; then
            echo -e "${GREEN}✓ Git is installed${NC}"
            git --version
        else
            echo -e "${YELLOW}✗ Git is not installed${NC}"
            echo "Install git from: https://git-scm.com/downloads"
        fi
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

