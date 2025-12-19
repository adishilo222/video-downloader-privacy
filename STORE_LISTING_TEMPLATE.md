# Chrome Web Store Listing Template

Use this template when filling out your extension's store listing in the Chrome Web Store Developer Dashboard.

## Basic Information

### Name
```
Video Downloader
```

### Short Description (Summary) - 132 characters max
```
Scan and download videos from any webpage with one click. Simple, fast, and free video downloader extension.
```

### Detailed Description - Up to 16,000 characters
```
🎥 Video Downloader - Download Videos from Any Website

Video Downloader is a simple and powerful Chrome extension that allows you to scan any webpage for videos and download them directly to your device with just one click.

✨ Features:
• Scan any webpage for embedded videos
• One-click download functionality
• View video details (size, duration, resolution)
• Works with most video formats (MP4, WebM, etc.)
• Clean and intuitive interface
• No registration required
• Completely free

🚀 How to Use:
1. Navigate to any webpage with videos
2. Click the Video Downloader icon in your toolbar
3. Click "Scan Page" to find all videos
4. Click "Download" on any video you want to save

🔒 Privacy & Security:
• No data collection
• No tracking
• All processing happens locally in your browser
• No external servers or third-party services
• Your privacy is our priority

📋 Permissions Explained:
• activeTab: Allows scanning the current page for videos when you click the extension
• downloads: Enables downloading video files to your device
• scripting: Required to detect video elements on web pages
• host_permissions: Needed to access video URLs across different websites (videos can be hosted on any domain)

💡 Use Cases:
• Save educational videos for offline viewing
• Download tutorial videos for later reference
• Archive important video content
• Create local backups of videos

⚠️ Important Notes:
• This extension only works with publicly accessible video URLs
• Some videos may be protected by copyright - please respect content creators' rights
• Videos embedded via blob URLs or data URIs cannot be downloaded
• Download speed depends on your internet connection

🔄 Updates:
We continuously work to improve the extension. If you encounter any issues or have suggestions, please let us know through the Chrome Web Store reviews.

Thank you for using Video Downloader!
```

## Category
Select: **Productivity** or **Utilities**

## Language
Select: **English (United States)** or your primary language

## Visual Assets

### Icon
- Use: `icons/icon128.png` (128x128 pixels)
- Must be PNG format

### Screenshots (Required - at least 1, up to 5)
Recommended size: **1280x800 pixels**

**Screenshot Ideas:**
1. Main popup interface showing the scan button
2. Popup showing a list of detected videos with thumbnails
3. Video details view (size, duration, resolution)
4. Download in progress
5. Success message after download

**Tips for Screenshots:**
- Use a clean, professional webpage as the background
- Show the extension popup clearly
- Highlight key features
- Use consistent styling
- Make text readable

### Small Promotional Tile (Optional but Recommended)
- Size: **440x280 pixels**
- Should represent your extension visually
- Include extension name or key visual element

## Privacy Practices

### Single Purpose
```
The extension has a single purpose: to scan web pages for video elements and enable users to download those videos to their local device.
```

### Permission Justification
```
The extension requires the <all_urls> host permission because:

1. Videos on the web can be hosted on any domain or subdomain
2. Users may want to download videos from any website they visit
3. The extension needs to access video URLs to enable downloads
4. Without this permission, the extension would only work on a limited set of websites, severely limiting its usefulness

The extension only accesses video elements and URLs when the user explicitly clicks the "Scan Page" button. It does not automatically scan pages or collect any data. All processing happens locally in the user's browser, and no information is transmitted to external servers.
```

### Privacy Policy URL
```
[Your privacy policy URL here - e.g., https://yourusername.github.io/video-downloader/privacy-policy.html]
```

### Data Collection Declaration
Select: **No data collected**

If asked about specific data types:
- Personal information: No
- Browsing history: No
- User activity: No
- Location: No
- Other data: No

## Distribution

### Visibility
- **Unlisted** (for testing): Only accessible via direct link
- **Public** (for release): Available to everyone in Chrome Web Store

### Regions
- Default: All regions (or select specific regions if needed)

### Pricing
- **Free**

## Additional Information

### Support URL (Optional)
```
[Your support URL - e.g., GitHub issues page, email, or website]
```

### Homepage URL (Optional)
```
[Your homepage URL - e.g., GitHub repository or website]
```

## Review Checklist

Before submitting, ensure:
- [ ] All required fields are completed
- [ ] Privacy policy URL is live and accessible
- [ ] At least one screenshot is uploaded
- [ ] Icon is uploaded (128x128)
- [ ] Permission justification is clear and detailed
- [ ] Description accurately describes the extension
- [ ] Extension ZIP file is uploaded and validated
- [ ] No errors shown in the dashboard
- [ ] All text is free of typos and grammatical errors

## Notes

- Review typically takes 1-3 business days
- Google may request additional information or clarification
- Respond promptly to any review requests
- Keep your extension updated and maintain the privacy policy

