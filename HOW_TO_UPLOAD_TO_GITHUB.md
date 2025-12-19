# How to Upload privacy-policy.html to GitHub

## Step-by-Step Instructions

### Step 1: Navigate to Your Repository
You're already on the right page: `https://github.com/adishilo222/video-downloader-privacy`

### Step 2: Find the Upload Link
On your repository page, look for this text:
> "Get started by creating a new file or uploading an existing file."

You'll see clickable links including:
- "creating a new file"
- **"uploading an existing file"** ← Click this one!

### Step 3: Upload the File
After clicking "uploading an existing file", you'll see an upload area. You have two options:

**Option A: Drag and Drop (Easiest)**
1. Open Finder (on Mac) or File Explorer (on Windows)
2. Navigate to: `/Users/I754199/Desktop/Chrome Extension for downloading videos/`
3. Find the file `privacy-policy.html`
4. Drag the file and drop it into the upload area on GitHub

**Option B: Click to Browse**
1. Click "choose your files" or the upload area
2. Browse to: `/Users/I754199/Desktop/Chrome Extension for downloading videos/`
3. Select `privacy-policy.html`
4. Click "Open" or "Choose"

### Step 4: Commit the File
1. After the file appears in the upload area, scroll down to the bottom of the page
2. You'll see a "Commit changes" section
3. The commit message will be pre-filled (you can change it if you want)
4. Make sure "Commit directly to the main branch" is selected
5. Click the green **"Commit changes"** button

### Step 5: Verify Upload
After clicking "Commit changes":
- You'll be redirected back to your repository
- You should see `privacy-policy.html` listed in your repository files
- The file is now uploaded!

## Visual Guide

```
GitHub Repository Page
├── [Code tab] ← You're here
├── "Get started by creating a new file or uploading an existing file"
│   └── Click: "uploading an existing file" ← Click this!
│
Upload Page
├── Drag & drop area OR "choose your files" button
│   └── Upload: privacy-policy.html
│
├── Scroll down to bottom
│   └── "Commit changes" section
│       ├── Commit message: "Add files via upload" (or customize)
│       ├── Radio button: "Commit directly to the main branch" ← Select this
│       └── Green button: "Commit changes" ← Click this!
│
Result
└── File appears in repository ✓
```

## Troubleshooting

### Can't find "uploading an existing file" link?
- Make sure you're on the main repository page (Code tab)
- The link is in the section that says "Get started by creating a new file..."
- If you don't see it, try refreshing the page

### File won't upload?
- Make sure the file is named exactly: `privacy-policy.html`
- Check that the file isn't too large (should be very small, a few KB)
- Try using a different browser
- Clear your browser cache and try again

### Don't see the file after committing?
- Refresh the page
- Make sure you're on the "Code" tab
- Check that you're looking at the "main" branch (should be selected by default)

## Next Steps After Upload

Once the file is uploaded:

1. **Enable GitHub Pages:**
   - Click the **"Settings"** tab (at the top of your repository)
   - Scroll down and click **"Pages"** in the left sidebar
   - Under "Source", select "Deploy from a branch"
   - Select **"main"** branch and **"/ (root)"** folder
   - Click **"Save"**

2. **Get Your Privacy Policy URL:**
   - Wait 1-2 minutes for GitHub to build the page
   - Your privacy policy will be at:
     `https://adishilo222.github.io/video-downloader-privacy/privacy-policy.html`
   - **Save this URL** - you'll need it for Chrome Web Store submission!

3. **Test the URL:**
   - Open the URL in a new browser tab (or incognito mode)
   - You should see your privacy policy page
   - If it works, you're ready to use it in your Chrome Web Store listing!

## Alternative: Using Git Commands (Advanced)

If you prefer using the command line:

```bash
cd "/Users/I754199/Desktop/Chrome Extension for downloading videos"
git clone https://github.com/adishilo222/video-downloader-privacy.git
cd video-downloader-privacy
cp ../privacy-policy.html .
git add privacy-policy.html
git commit -m "Add privacy policy"
git push origin main
```

But the web interface (drag & drop) is much easier! 😊

