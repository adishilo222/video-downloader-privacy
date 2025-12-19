#!/bin/bash

# Script to connect to your existing GitHub repository and push changes

echo "🚀 GitHub Repository Setup"
echo "=========================="
echo ""

# Check if we already have a remote
if git remote get-url origin 2>/dev/null; then
    echo "✓ Remote 'origin' already configured:"
    git remote get-url origin
    echo ""
    read -p "Do you want to update the remote URL? (y/n): " update_remote
    if [ "$update_remote" = "y" ]; then
        read -p "Enter your GitHub repository URL: " repo_url
        git remote set-url origin "$repo_url"
        echo "✓ Remote URL updated"
    fi
else
    echo "No remote configured yet."
    read -p "Enter your GitHub repository URL (e.g., https://github.com/username/repo.git): " repo_url
    git remote add origin "$repo_url"
    echo "✓ Remote 'origin' added"
fi

echo ""
echo "Adding workflow files to git..."
git add .github/

echo ""
echo "Committing workflow..."
git commit -m "Add GitHub Actions workflow for auto-versioning and packaging" || echo "No new changes to commit"

echo ""
echo "Current branch:"
git branch --show-current

echo ""
read -p "Push to GitHub? This will upload your changes. (y/n): " do_push

if [ "$do_push" = "y" ]; then
    current_branch=$(git branch --show-current)
    echo "Pushing to origin/$current_branch..."
    git push -u origin "$current_branch"
    echo ""
    echo "✓ Successfully pushed to GitHub!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Visit your GitHub repository"
    echo "2. The workflow will run automatically on future pushes to main"
    echo "3. It will auto-increment the version and create releases"
else
    echo ""
    echo "Skipped push. You can push manually later with:"
    echo "  git push -u origin $(git branch --show-current)"
fi

echo ""
echo "Done! 🎉"
