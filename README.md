# Chrome Extension Video Downloader

A Chrome extension that scans web pages for videos, displays their thumbnails, size, duration, and allows you to download them directly.

## Features

- 🔍 Scan any webpage for embedded videos
- 🖼️ View thumbnails for each video found
- 📊 See video details (file size, duration, resolution)
- ⬇️ Download videos with one click
- ⚡ Handles blob URLs and platform videos (YouTube, Vimeo, etc.)
- 🎨 Modern, clean UI with glassmorphism design

## Installation

1. Clone this repository or download the ZIP
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Select the folder containing this extension
6. The extension icon should appear in your Chrome toolbar

## Usage

1. Navigate to any webpage that contains videos
2. Click the extension icon in your Chrome toolbar
3. The extension will automatically scan for videos
4. Click **Refresh** to rescan if needed
5. Click **Download** on any video to save it

## Understanding Blob URLs

**What are Blob URLs?**  
Blob URLs (like `blob:https://example.com/...`) are temporary video references stored in browser memory. They're commonly used by streaming sites to play videos without exposing the direct video file URL.

**Why they might not work:**

- They're temporary and expire when you refresh the page or when the website creates a new blob
- They're tied to the browser session
- Many streaming sites use protected blob URLs that can't be downloaded directly

**What you can do:**

- Try downloading immediately when you find the video (before the blob expires)
- For persistent downloads, look for the actual video file URL if available
- Some sites require special downloaders or browser extensions that capture the video stream

## Version History

### 1.2.8 (Current)

- Fixed async function issue in video scanning
- Improved blob URL handling and messaging
- Enhanced thumbnail display with better fallbacks
- Orange gradient for blob video thumbnails to distinguish temporary URLs
- Better visual feedback for different video types

### 1.2.7

- Previous stable release

## Development

### Making Changes

1. Make your code changes
2. Update version in `manifest.json`
3. Go to `chrome://extensions/`
4. Click the refresh icon on the extension card
5. Test your changes

### File Structure

```
├── manifest.json       # Extension configuration
├── popup.html          # Extension popup UI
├── popup.css           # Styling for the popup
├── popup.js            # Main extension logic
├── content.js          # Content script
└── icons/              # Extension icons
```

## Permissions

- **activeTab**: Access the current tab to scan for videos
- **downloads**: Download videos to your computer
- **scripting**: Inject scripts that scan for videos

## License

MIT License - Feel free to use and modify
