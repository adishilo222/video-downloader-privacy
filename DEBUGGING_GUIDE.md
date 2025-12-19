# Chrome Extension Debugging Guide

This guide explains how to debug errors in the Video Downloader extension.

## Quick Start

1. **Open Extension Management Page**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Find "Video Downloader" extension

2. **Check for Errors**
   - Look for red error messages under the extension name
   - Click "Errors" button if available
   - Check the browser console (see below)

## Debugging Methods

### 1. Debug the Popup (Extension UI)

The popup is the window that opens when you click the extension icon.

**Steps:**
1. Right-click on the extension icon in the toolbar
2. Select "Inspect popup" (or "Inspect" if available)
3. This opens DevTools for the popup
4. Go to the **Console** tab to see errors and logs
5. Look for messages prefixed with `[Video Downloader]`

**What to look for:**
- Red error messages
- Console logs showing what the extension is doing
- Network errors if any

**Common Popup Errors:**
- Missing DOM elements
- Script injection failures
- Tab access errors

### 2. Debug Content Scripts (Page Context)

Content scripts run on web pages. To debug them:

**Method 1: Regular Page Console**
1. Open the webpage where the extension should work
2. Press `F12` or right-click → "Inspect"
3. Go to **Console** tab
4. Look for messages from the extension
5. The extension logs messages like:
   - `[Video Downloader] scanForVideos started`
   - `[Video Downloader] Found X videos`

**Method 2: Extension's Debug Feature**
1. Click the extension icon
2. Click the "🔍 Debug" button
3. This will show detailed debug information about the page
4. Copy the debug info and share it for troubleshooting

### 3. Debug Background/Service Worker (if applicable)

If the extension has a background script:
1. Go to `chrome://extensions/`
2. Find your extension
3. Click "service worker" or "background page" link
4. This opens DevTools for the background script

### 4. Check Extension Errors Page

1. Go to `chrome://extensions/`
2. Find "Video Downloader"
3. Click "Errors" button (if errors exist)
4. This shows a detailed error log

## Using the Built-in Debug Feature

The extension includes a debug feature:

1. **Open the extension popup**
2. **Click the "🔍 Debug" button**
3. **Review the debug output** which includes:
   - Page URL and title
   - Video elements found
   - Iframes detected
   - Data attributes with video URLs
   - Source elements
   - Custom elements
   - Video player libraries detected
   - Summary of detectable videos

4. **Copy debug info:**
   - Click "📋 Copy Debug Info" button
   - Paste it somewhere to share or analyze

## Common Error Types and Solutions

### Error: "Cannot access this page"
- **Cause:** Trying to use extension on `chrome://` pages or extension pages
- **Solution:** Use on regular web pages only

### Error: "No results returned from page scan"
- **Cause:** Page not fully loaded or script injection failed
- **Solution:** 
  - Refresh the page
  - Wait a few seconds for page to load
  - Try clicking "Refresh" in the extension

### Error: "Video scan did not return a valid array"
- **Cause:** Script injection returned unexpected data
- **Solution:**
  - Check browser console for detailed error
  - Try on a different page
  - Reload the extension

### Error: "Extension UI elements not found"
- **Cause:** Popup HTML structure changed or corrupted
- **Solution:**
  - Reload the extension (`chrome://extensions/` → click refresh icon)
  - Check if `popup.html` exists and is valid

### Error: "Script injection failed"
- **Cause:** Page security restrictions or extension permissions
- **Solution:**
  - Check if extension has necessary permissions
  - Try on a different page
  - Check browser console for specific error message

## Debugging Checklist

When reporting an error, include:

- [ ] **Error message** (exact text)
- [ ] **Page URL** where error occurred
- [ ] **Browser console output** (F12 → Console tab)
- [ ] **Extension console output** (right-click extension icon → Inspect popup)
- [ ] **Debug output** (click Debug button in extension)
- [ ] **Steps to reproduce** the error
- [ ] **Browser version** (chrome://version)
- [ ] **Extension version** (shown in chrome://extensions/)

## Advanced Debugging

### Enable Verbose Logging

The extension already includes console logging. To see all logs:

1. Open browser console (F12)
2. Filter by typing `[Video Downloader]` in the console filter
3. This shows all extension-related logs

### Network Tab Debugging

If videos aren't being detected:

1. Open DevTools (F12)
2. Go to **Network** tab
3. Filter by "media" or "video"
4. Reload the page
5. Look for video file requests
6. Check the URLs - these might be the actual video sources

### Elements Tab Inspection

1. Open DevTools (F12)
2. Go to **Elements** tab
3. Search for `<video>` elements
4. Check their `src` attributes
5. Look for `<source>` elements inside videos
6. Check for iframes with video embeds

## Console Commands

You can run these in the browser console (on a webpage):

```javascript
// Check if extension functions are available
window.scanForVideos

// Manually scan for videos (if function is available)
window.scanForVideos()

// Check for video elements
document.querySelectorAll('video')

// Check for iframes
document.querySelectorAll('iframe')
```

## Getting Help

When asking for help, provide:

1. **Screenshot** of the error (if visible)
2. **Console output** (copy/paste from console)
3. **Debug output** (from extension's Debug button)
4. **Page URL** where error occurred
5. **What you were trying to do** when error happened

## Tips

- **Always check the console first** - most errors show up there
- **Use the Debug button** - it provides comprehensive page analysis
- **Reload the extension** after making changes
- **Clear browser cache** if issues persist
- **Test on different pages** to see if error is page-specific
- **Check extension permissions** in chrome://extensions/

## Quick Debug Commands

```bash
# Check for syntax errors in popup.js
node -c popup.js

# Check manifest.json validity
# (Chrome will show errors when loading extension)
```

## Extension Log Locations

- **Popup logs:** Right-click extension icon → Inspect popup → Console
- **Content script logs:** F12 on webpage → Console tab
- **Background logs:** chrome://extensions/ → Click "service worker" link
- **Extension errors:** chrome://extensions/ → Click "Errors" button

---

**Remember:** Most debugging can be done using:
1. Browser console (F12)
2. Extension's Debug button
3. Extension popup console (right-click icon → Inspect popup)

