# Testing Instructions

## Step 1: Reload the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Find "Video Downloader" extension
3. Click the **RELOAD** button (circular arrow icon) on the extension card
4. Make sure the version shows **1.2.0**

## Step 2: Check for Errors

1. After reloading, open the browser console (F12 or right-click → Inspect)
2. Go to the Console tab
3. Look for any red error messages
4. If you see errors, note them down

## Step 3: Test on a Simple Page

1. Open this test page: `file:///Users/I754199/Desktop/Chrome Extension for downloading videos/test-video-page.html`
2. Click the extension icon
3. Open the browser console (F12) and look for messages starting with `[Video Downloader]`
4. Check if you see:
   - `[Video Downloader] Starting scan for tab:`
   - `[Video Downloader] scanForVideosWithRetry started on:`
   - `[Video Downloader] First scan completed, found: X videos`

## Step 4: Check Extension Popup

1. The extension popup should show either:
   - A list of videos (if found)
   - "No videos found on this page" (if none found)
   - An error message (if something failed)

## Step 5: If Nothing Works

1. Check the browser console for errors
2. Try the Debug button in the extension popup
3. Note any error messages you see

## Common Issues:

- **"Cannot access this page"**: You're on a chrome:// or extension page - try a regular website
- **"No results returned"**: The page might not be fully loaded - wait a few seconds and try again
- **Extension not reloading**: Make sure you clicked the RELOAD button, not just refresh the page

