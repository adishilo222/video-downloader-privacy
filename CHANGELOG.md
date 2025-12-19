# Changelog

## Version 1.1.0 - Enhanced Video Detection

### New Features

✅ **Embedded Video Support**
- Now detects YouTube videos in iframes
- Now detects Vimeo videos in iframes
- Now detects Dailymotion videos in iframes
- Extracts video IDs and creates watch URLs
- Shows platform indicator (YouTube, Vimeo, etc.)

✅ **Enhanced Detection**
- Detects video URLs in data attributes (`data-video-url`, `data-src`)
- Detects video links (`.mp4`, `.webm`, `.ogg` files)
- Better iframe detection for various video platforms

✅ **Improved User Experience**
- For embedded videos, "Open Video" button opens the video in a new tab
- Platform information displayed for embedded videos
- YouTube thumbnails automatically loaded

### Technical Details

**YouTube Detection:**
- Supports multiple URL formats:
  - `youtube.com/watch?v=VIDEO_ID`
  - `youtube.com/embed/VIDEO_ID`
  - `youtu.be/VIDEO_ID`
  - `youtube-nocookie.com` embeds
- Extracts video ID and creates watch URL
- Loads YouTube thumbnail automatically

**Vimeo Detection:**
- Supports `vimeo.com/VIDEO_ID` format
- Supports `player.vimeo.com/video/VIDEO_ID` format
- Creates watch URL for user access

**Dailymotion Detection:**
- Supports `dailymotion.com/video/VIDEO_ID` format
- Supports `dailymotion.com/embed/video/VIDEO_ID` format
- Loads Dailymotion thumbnail

### Limitations

- Direct download of YouTube/Vimeo videos isn't always possible due to platform restrictions
- For embedded videos, the extension opens the watch page instead
- Duration and size information not available for embedded videos (would require API access)
- Some videos may require authentication or have download restrictions

### Files Changed

- `popup.js` - Enhanced `scanForVideos()` function with iframe detection
- `popup.js` - Updated `downloadVideo()` to handle embedded videos
- `popup.js` - Added platform indicator in video details

### Test Pages

- `test-video-page.html` - HTML5 video elements (original)
- `test-embedded-videos.html` - Embedded YouTube/Vimeo/Dailymotion videos (new)

---

## Version 1.0.0 - Initial Release

- Basic HTML5 video detection
- Video download functionality
- Thumbnail display
- Video details (size, duration, resolution)

