document.addEventListener('DOMContentLoaded', () => {
  try {
    const scanBtn = document.getElementById('scanBtn');
    const debugBtn = document.getElementById('debugBtn');
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const videoList = document.getElementById('videoList');
    const emptyState = document.getElementById('emptyState');
    const debugPanel = document.getElementById('debugPanel');
    const debugInfo = document.getElementById('debugInfo');
    const copyDebugBtn = document.getElementById('copyDebugBtn');
    const closeDebugBtn = document.getElementById('closeDebugBtn');

    // Check if all required elements exist
    if (!scanBtn || !loading || !error || !videoList || !emptyState) {
      console.error('[Video Downloader] Missing required DOM elements');
      if (error) {
        error.classList.remove('hidden');
        error.textContent = 'Error: Extension UI elements not found. Please reload the extension.';
      }
      return;
    }

    // Track active downloads to prevent duplicates and ensure one-by-one downloads
    const activeDownloads = new Set();

    // Toast notification function
    function showToast(message, type = 'success') {
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = message;
      toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: ${type === 'success' ? 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)' : 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-size: 14px;
      font-weight: 600;
      z-index: 10000;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

      document.body.appendChild(toast);

      // Animate in
      setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(0)';
      }, 10);

      // Animate  out and remove
      setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(100px)';
        setTimeout(() => {
          document.body.removeChild(toast);
        }, 300);
      }, 2500);
    }

    // Function to capture thumbnails from videos
    async function captureThumbnails(tabId, videos) {
      console.log('[Video Downloader] Capturing thumbnails for', videos.length, 'videos');

      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: (videoData) => {
            const thumbnails = {};
            const videoElements = document.querySelectorAll('video');

            videoElements.forEach((video, index) => {
              try {
                // Skip if we already have a poster
                const videoSrc = video.src || video.currentSrc || '';
                if (!videoSrc || video.poster) return;

                // Only capture if video has loaded some data
                if (video.readyState < 2) return; // HAVE_CURRENT_DATA

                // Create canvas to capture frame
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 320;
                canvas.height = video.videoHeight || 180;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Convert to data URL
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

                // Store with video URL as key
                if (dataUrl && dataUrl.length > 100) { // Valid thumbnail
                  thumbnails[videoSrc] = dataUrl;
                }
              } catch (e) {
                // Skip videos that can't be captured (CORS, etc.)
              }
            });

            return thumbnails;
          },
          args: [videos.map(v => ({ url: v.url, blobUrl: v.blobUrl }))]
        });

        if (result && result[0] && result[0].result) {
          const thumbnails = result[0].result;
          console.log('[Video Downloader] Captured', Object.keys(thumbnails).length, 'thumbnails');

          // Update video objects with captured thumbnails
          videos.forEach(video => {
            const key = video.blobUrl || video.url;
            if (!video.thumbnail && thumbnails[key]) {
              video.thumbnail = thumbnails[key];
              video.thumbnailCaptured = true;
            }
          });
        }
      } catch (err) {
        console.warn('[Video Downloader] Thumbnail capture error:', err);
        // Non-critical error, continue without thumbnails
      }
    }

    // Function to scan for videos
    async function performScan() {
      try {
        // Show loading state
        loading.classList.remove('hidden');
        error.classList.add('hidden');
        videoList.innerHTML = '';
        emptyState.classList.add('hidden');

        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Execute content script to scan for videos with multiple attempts for dynamic content
        let results;
        try {
          console.log('[Video Downloader] Starting scan for tab:', tab.id, tab.url);

          // Inject scanForVideos directly - it's self-contained
          // We'll handle retries in the popup if needed
          let videos = [];
          const isFileProtocol = tab.url.startsWith('file://');

          // First attempt
          try {
            const firstResult = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: scanForVideos
            });
            videos = firstResult[0]?.result || [];
            if (!Array.isArray(videos)) videos = [];
          } catch (err) {
            console.error('[Video Downloader] First scan failed:', err);
          }

          // Retry if no videos found (for dynamic content)
          if (videos.length === 0 && !isFileProtocol) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
              const retryResult = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: scanForVideos
              });
              videos = retryResult[0]?.result || [];
              if (!Array.isArray(videos)) videos = [];
            } catch (err) {
              console.error('[Video Downloader] Retry scan failed:', err);
            }
          }

          // One more retry if still no videos
          if (videos.length === 0 && !isFileProtocol) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            try {
              const finalResult = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: scanForVideos
              });
              videos = finalResult[0]?.result || [];
              if (!Array.isArray(videos)) videos = [];
            } catch (err) {
              console.error('[Video Downloader] Final scan failed:', err);
            }
          }

          results = [{ result: videos }];

          console.log('[Video Downloader] Script executed, results:', results);
        } catch (scriptError) {
          console.error('[Video Downloader] Script injection error:', scriptError);
          // If script injection fails (e.g., on chrome:// pages), try direct scan
          if (scriptError.message.includes('Cannot access') || scriptError.message.includes('Cannot access a chrome://')) {
            throw new Error('Cannot access this page. Please try on a regular webpage (not chrome:// or extension pages).');
          }
          if (scriptError.message.includes('No tab with id')) {
            throw new Error('Tab not found. Please refresh the page and try again.');
          }
          throw new Error(`Script injection failed: ${scriptError.message}`);
        }

        // Safely get videos array with null checks
        if (!results || !results[0]) {
          console.error('[Video Downloader] No results returned from script');
          throw new Error('No results returned from page scan. The page may not be fully loaded.');
        }

        const videos = results[0].result;

        console.log('[Video Downloader Popup] Received results:', {
          hasResults: !!results,
          hasFirstResult: !!results[0],
          resultType: typeof videos,
          isArray: Array.isArray(videos),
          videoCount: videos?.length || 0,
          sample: Array.isArray(videos) ? videos.slice(0, 2).map(v => ({ url: v?.url?.substring(0, 50), title: v?.title?.substring(0, 30) })) : 'not an array'
        });

        // Ensure videos is an array
        if (!Array.isArray(videos)) {
          console.error('[Video Downloader Popup] Video scan returned non-array:', videos);
          throw new Error('Video scan did not return a valid array');
        }

        loading.classList.add('hidden');

        if (videos.length === 0) {
          console.log('[Video Downloader Popup] No videos found - showing empty state');
          emptyState.classList.remove('hidden');
          emptyState.innerHTML = `
            <p style="font-size: 16px; color: #666; margin-bottom: 12px;">
              No videos found on this page
            </p>
            <p style="font-size: 13px; color: #999; line-height: 1.6;">
              This could be because:<br>
              • The video hasn't loaded yet<br>
              • Video is protected or using a player we can't detect<br>
              • Page uses streaming instead of direct video files<br>
              <br>
              Try refreshing the page and waiting for videos to load!
            </p>
          `;
        } else {
          console.log(`[Video Downloader Popup] Displaying ${videos.length} videos`);

          // Show count in loading message temporarily
          loading.classList.remove('hidden');
          const loadingText = loading.querySelector('p');
          if (loadingText) {
            loadingText.textContent = `Found ${videos.length} video${videos.length !== 1 ? 's' : ''}! Capturing thumbnails...`;
          }

          // Capture thumbnails for videos that don't have them
          try {
            await captureThumbnails(tab.id, videos);
          } catch (thumbError) {
            console.warn('[Video Downloader] Thumbnail capture failed:', thumbError);
            // Continue anyway - videos will show placeholders
          }

          loading.classList.add('hidden');
          displayVideos(videos);
        }
      } catch (err) {
        console.error('[Video Downloader Popup] Error in performScan:', err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
        error.textContent = `Error: ${err.message}\n\nCheck the browser console (F12) for more details.`;
        error.style.whiteSpace = 'pre-wrap';
        error.style.fontSize = '12px';

        // Also log to console for debugging
        console.error('Full error:', err);
        console.error('Error stack:', err.stack);
      }
    }

    // Debug function to analyze page
    async function performDebug() {
      try {
        // Show debug panel
        debugPanel.classList.remove('hidden');
        debugInfo.textContent = '🔍 Analyzing page...\n\nPlease wait...';

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Collect comprehensive debug information
        let debugText = `═══════════════════════════════════════════════════════════\n`;
        debugText += `🔍 VIDEO DOWNLOADER - COMPREHENSIVE DEBUG REPORT\n`;
        debugText += `═══════════════════════════════════════════════════════════\n\n`;
        debugText += `📅 Timestamp: ${new Date().toISOString()}\n`;
        debugText += `🌐 URL: ${tab.url}\n`;
        debugText += `📑 Title: ${tab.title}\n\n`;

        // Try to get page analysis
        let debugData = null;
        try {
          const debugResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: debugPageAnalysis
          });
          debugData = debugResults[0].result;
        } catch (scriptError) {
          debugText += `❌ ERROR: Could not inject debug script\n`;
          debugText += `   Error: ${scriptError.message}\n`;
          debugText += `   This might be a chrome:// or extension page\n\n`;
        }

        // Try to get scan results
        let scanResults = null;
        let scanError = null;
        try {
          debugText += `\n🔄 Attempting video scan...\n`;
          const scanAttempt = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scanForVideosWithRetry
          });
          scanResults = scanAttempt[0].result;
          debugText += `✅ Scan completed successfully\n`;
          debugText += `   Results type: ${typeof scanResults}\n`;
          debugText += `   Is array: ${Array.isArray(scanResults)}\n`;
          if (Array.isArray(scanResults)) {
            debugText += `   Videos found: ${scanResults.length}\n`;
          }
        } catch (scanErr) {
          scanError = scanErr;
          debugText += `❌ Scan failed\n`;
          debugText += `   Error: ${scanErr.message}\n`;
          debugText += `   Error type: ${scanErr.name}\n`;
          if (scanErr.stack) {
            debugText += `   Stack: ${scanErr.stack.substring(0, 500)}\n`;
          }
        }

        debugText += `\n`;
        debugText += `═══════════════════════════════════════════════════════════\n`;
        debugText += `📊 PAGE ANALYSIS\n`;
        debugText += `═══════════════════════════════════════════════════════════\n\n`;

        if (debugData) {
          debugText += `📍 URL: ${debugData.url}\n\n`;

          debugText += `📹 VIDEO ELEMENTS FOUND: ${debugData.videoElements.length}\n`;
          if (debugData.videoElements.length > 0) {
            debugData.videoElements.forEach((el, i) => {
              debugText += `  ${i + 1}. <video> - src: ${el.src || 'none'}\n`;
              debugText += `     Sources: ${el.sources.length} found\n`;
              el.sources.forEach(src => debugText += `       - ${src}\n`);
            });
          } else {
            debugText += `  ❌ No <video> elements found\n`;
          }
          debugText += `\n`;

          debugText += `🖼️ IFRAMES FOUND: ${debugData.iframes.length}\n`;
          if (debugData.iframes.length > 0) {
            debugData.iframes.forEach((iframe, i) => {
              debugText += `  ${i + 1}. <iframe> - src: ${iframe.src || 'none'}\n`;
              if (iframe.src) {
                if (iframe.src.includes('youtube')) debugText += `     ✅ YouTube detected\n`;
                if (iframe.src.includes('vimeo')) debugText += `     ✅ Vimeo detected\n`;
                if (iframe.src.includes('dailymotion')) debugText += `     ✅ Dailymotion detected\n`;
              }
            });
          } else {
            debugText += `  ❌ No <iframe> elements found\n`;
          }
          debugText += `\n`;

          debugText += `🔗 VIDEO URLS IN DATA ATTRIBUTES: ${debugData.dataUrls.length}\n`;
          if (debugData.dataUrls.length > 0) {
            debugData.dataUrls.forEach((url, i) => {
              debugText += `  ${i + 1}. ${url}\n`;
            });
          } else {
            debugText += `  ❌ No video URLs in data attributes\n`;
          }
          debugText += `\n`;

          debugText += `🎬 SOURCE ELEMENTS: ${debugData.sourceElements.length}\n`;
          if (debugData.sourceElements.length > 0) {
            debugData.sourceElements.forEach((src, i) => {
              debugText += `  ${i + 1}. <source> - src: ${src.src}, type: ${src.type}\n`;
            });
          } else {
            debugText += `  ❌ No <source> elements found\n`;
          }
          debugText += `\n`;

          debugText += `🔍 CUSTOM ELEMENTS (Web Components): ${debugData.customElements.length}\n`;
          if (debugData.customElements.length > 0) {
            debugData.customElements.forEach((el, i) => {
              debugText += `  ${i + 1}. <${el.tagName.toLowerCase()}>\n`;
              if (el.attributes.length > 0) {
                Array.from(el.attributes).forEach(attr => {
                  if (attr.name.includes('video') || attr.name.includes('src') || attr.name.includes('data')) {
                    debugText += `     ${attr.name}: ${attr.value.substring(0, 100)}\n`;
                  }
                });
              }
            });
          } else {
            debugText += `  ❌ No custom elements found\n`;
          }
          debugText += `\n`;

          debugText += `🌐 PAGE TYPE: ${debugData.pageType}\n`;
          if (debugData.pageType === 'youtube') {
            debugText += `  ✅ YouTube watch page detected\n`;
            debugText += `  Video ID: ${debugData.youtubeVideoId || 'not found'}\n`;
          }
          debugText += `\n`;

          if (debugData.videoPlayers && debugData.videoPlayers.length > 0) {
            debugText += `🎮 VIDEO PLAYER LIBRARIES DETECTED:\n`;
            debugData.videoPlayers.forEach(player => {
              debugText += `  ✅ ${player}\n`;
            });
            debugText += `\n`;
          }

          if (debugData.playerContainers && debugData.playerContainers.length > 0) {
            debugText += `📦 VIDEO PLAYER CONTAINERS:\n`;
            debugData.playerContainers.slice(0, 10).forEach(container => {
              debugText += `  - ${container.selector}: ${container.count} found\n`;
            });
            debugText += `\n`;
          }

          debugText += `📊 SUMMARY:\n`;
          debugText += `  Total potential videos: ${debugData.totalPotentialVideos}\n`;
          debugText += `  Videos that would be detected: ${debugData.detectableVideos}\n`;
          debugText += `\n`;
          debugText += `💡 TIPS:\n`;
          if (debugData && debugData.detectableVideos === 0) {
            debugText += `  - This page may use a custom video player\n`;
            debugText += `  - Videos might be loaded dynamically via JavaScript\n`;
            debugText += `  - Check browser console (F12) for video-related network requests\n`;
            debugText += `  - Look for video URLs in Network tab of DevTools\n`;
          }
        }

        debugInfo.textContent = debugText;

      } catch (err) {
        debugInfo.textContent = `Debug Error: ${err.message}\n\n${err.stack}`;
      }
    }

    // Copy debug info button
    if (copyDebugBtn) {
      copyDebugBtn.addEventListener('click', async () => {
        const debugText = debugInfo.textContent;
        try {
          await navigator.clipboard.writeText(debugText);
          copyDebugBtn.textContent = '✓ Copied!';
          copyDebugBtn.classList.add('copied');
          setTimeout(() => {
            copyDebugBtn.textContent = '📋 Copy Debug Info';
            copyDebugBtn.classList.remove('copied');
          }, 2000);
        } catch (err) {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = debugText;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
            copyDebugBtn.textContent = '✓ Copied!';
            copyDebugBtn.classList.add('copied');
            setTimeout(() => {
              copyDebugBtn.textContent = '📋 Copy Debug Info';
              copyDebugBtn.classList.remove('copied');
            }, 2000);
          } catch (e) {
            alert('Failed to copy. Please select and copy the text manually.');
          }
          document.body.removeChild(textArea);
        }
      });
    }

    // Close debug panel button
    if (closeDebugBtn) {
      closeDebugBtn.addEventListener('click', () => {
        debugPanel.classList.add('hidden');
      });
    }

    // Automatically scan when popup opens
    performScan();

    // Allow manual refresh with the button
    if (scanBtn) {
      scanBtn.addEventListener('click', performScan);
    }
    if (debugBtn) {
      debugBtn.addEventListener('click', performDebug);
    }

    function displayVideos(videos) {
      emptyState.classList.add('hidden');
      videoList.innerHTML = '';

      videos.forEach((video, index) => {
        const videoItem = createVideoItem(video, index);
        videoList.appendChild(videoItem);
      });
    }

    function createVideoItem(video, index) {
      const item = document.createElement('div');
      item.className = 'video-item';

      const thumbnail = document.createElement('img');
      thumbnail.className = 'video-thumbnail';
      thumbnail.alt = video.altText || video.title || 'Video thumbnail';
      thumbnail.title = video.title || 'Video thumbnail';

      // Set thumbnail with proper error handling
      if (video.thumbnail) {
        thumbnail.src = video.thumbnail;
        thumbnail.onerror = function () {
          this.onerror = null; // Prevent infinite loop
          // Try to extract just the video ID/name for cleaner placeholder
          const videoIdentifier = video.title?.substring(0, 20) || 'Video';
          this.src = 'data:image/svg+xml,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="101">' +
            '<defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />' +
            '<stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" /></linearGradient></defs>' +
            '<rect width="180" height="101" fill="url(#grad)"/>' +
            '<text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-family="sans-serif" font-size="24" font-weight="600">🎬</text>' +
            '</svg>'
          );
        };
      } else if (video.isBlob) {
        // Blob videos get orange gradient placeholder
        thumbnail.src = 'data:image/svg+xml,' + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="101">' +
          '<defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">' +
          '<stop offset="0%" style="stop-color:#ff9800;stop-opacity:1" />' +
          '<stop offset="100%" style="stop-color:#f57c00;stop-opacity:1" /></linearGradient></defs>' +
          '<rect width="180" height="101" fill="url(#grad)"/>' +
          '<text x="50%" y="45%" text-anchor="middle" dy=".3em" fill="white" font-family="sans-serif" font-size="16" font-weight="600">⚡</text>' +
          '<text x="50%" y="60%" text-anchor="middle" dy=".3em" fill="white" font-family="sans-serif" font-size="11">Temporary</text>' +
          '</svg>'
        );
      } else if (video.isHunted) {
        // Hunted videos get a green "Success/Rocket" gradient
        thumbnail.src = 'data:image/svg+xml,' + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="101">' +
          '<defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">' +
          '<stop offset="0%" style="stop-color:#4caf50;stop-opacity:1" />' +
          '<stop offset="100%" style="stop-color:#2e7d32;stop-opacity:1" /></linearGradient></defs>' +
          '<rect width="180" height="101" fill="url(#grad)"/>' +
          '<text x="50%" y="45%" text-anchor="middle" dy=".3em" fill="white" font-family="sans-serif" font-size="16" font-weight="600">🚀</text>' +
          '<text x="50%" y="60%" text-anchor="middle" dy=".3em" fill="white" font-family="sans-serif" font-size="11">Direct URL</text>' +
          '</svg>'
        );
      } else {
        // Regular videos without thumbnails
        thumbnail.src = 'data:image/svg+xml,' + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="101">' +
          '<defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">' +
          '<stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />' +
          '<stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" /></linearGradient></defs>' +
          '<rect width="180" height="101" fill="url(#grad)"/>' +
          '<text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-family="sans-serif" font-size="24" font-weight="600">🎬</text>' +
          '</svg>'
        );
      }

      // Add click handler to open video in new tab
      thumbnail.addEventListener('click', () => {
        if (video.url) {
          chrome.tabs.create({ url: video.url });
        }
      });

      // Create main content wrapper
      const contentWrapper = document.createElement('div');
      contentWrapper.style.display = 'flex';
      contentWrapper.style.gap = '16px';
      contentWrapper.style.flex = '1';
      contentWrapper.style.minWidth = '0';

      const info = document.createElement('div');
      info.className = 'video-info';
      info.style.flex = '1';
      info.style.minWidth = '0';

      const title = document.createElement('div');
      title.className = 'video-title';
      title.textContent = video.title || `Video ${index + 1}`;
      title.title = video.title || `Video ${index + 1}`;

      // Add alt text as subtitle if available and different from title
      let titleContainer = title;
      if (video.altText && video.altText !== video.title) {
        const subtitle = document.createElement('div');
        subtitle.className = 'video-subtitle';
        subtitle.textContent = video.altText;
        subtitle.title = video.altText;
        titleContainer = document.createElement('div');
        titleContainer.className = 'video-title-container';
        titleContainer.appendChild(title);
        titleContainer.appendChild(subtitle);
      }

      const details = document.createElement('div');
      details.className = 'video-details';

      // Size
      const sizeItem = document.createElement('div');
      sizeItem.className = 'detail-item';
      sizeItem.innerHTML = `<span class="detail-label">Size</span> <span>${video.size || 'Unknown'}</span>`;

      // Duration
      const durationItem = document.createElement('div');
      durationItem.className = 'detail-item';
      durationItem.innerHTML = `<span class="detail-label">Duration</span> <span>${video.duration || 'Unknown'}</span>`;

      // Blob URL indicator with helpful explanation
      if (video.isBlob) {
        const blobItem = document.createElement('div');
        blobItem.className = 'detail-item';
        blobItem.style.color = '#ff9800';
        blobItem.style.fontWeight = '600';
        blobItem.style.wordBreak = 'break-word';
        blobItem.style.overflowWrap = 'break-word';
        blobItem.innerHTML = `<span class="detail-label">⚡ Type:</span> <span>Temporary Memory URL</span>`;
        blobItem.title = 'Blob URLs are temporary video references stored in browser memory. They may expire when you refresh the page.';
        details.insertBefore(blobItem, details.firstChild);
      }

      // Hunted URL indicator
      if (video.isHunted) {
        const huntItem = document.createElement('div');
        huntItem.className = 'detail-item';
        huntItem.style.color = '#4caf50';
        huntItem.style.fontWeight = '600';
        huntItem.innerHTML = `<span class="detail-label">🚀 Type:</span> <span>Direct Download</span>`;
        huntItem.title = 'This original source URL was found in the network logs, allowing for an instant, high-quality download.';
        details.insertBefore(huntItem, details.firstChild);
      }

      details.appendChild(sizeItem);
      details.appendChild(durationItem);

      // Create button container for Download and Copy URL
      const buttonContainer = document.createElement('div');
      buttonContainer.style.display = 'flex';
      buttonContainer.style.flexDirection = 'column';
      buttonContainer.style.gap = '8px';
      buttonContainer.style.alignSelf = 'center';

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'download-btn';

      // Handle different video types
      if (video.platform) {
        downloadBtn.innerHTML = '<span>Open Video</span>';
      } else if (video.isBlob && !video.canDownload) {
        downloadBtn.innerHTML = '<span>Copy Blob URL</span>';
        downloadBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      } else {
        downloadBtn.innerHTML = '<span>Download</span>';
      }

      downloadBtn.addEventListener('click', () => downloadVideo(video, downloadBtn));

      // Add Copy URL button for all videos
      const copyBtn = document.createElement('button');
      copyBtn.className = 'download-btn';
      copyBtn.style.background = 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)';
      copyBtn.style.boxShadow = '0 4px 16px rgba(33, 150, 243, 0.4)';
      copyBtn.style.minWidth = '100px';
      copyBtn.style.fontSize = '12px';
      copyBtn.style.padding = '8px 16px';
      copyBtn.innerHTML = '<span>📋 Copy URL</span>';
      copyBtn.title = 'Copy video URL to clipboard';

      copyBtn.addEventListener('click', async () => {
        try {
          const urlToCopy = video.blobUrl || video.url;
          await navigator.clipboard.writeText(urlToCopy);

          // Show success feedback
          const originalHTML = copyBtn.innerHTML;
          copyBtn.innerHTML = '<span>✓ Copied!</span>';
          copyBtn.style.background = 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)';

          // Show toast notification
          showToast('URL copied to clipboard!', 'success');

          setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
            copyBtn.style.background = 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)';
          }, 2000);
        } catch (err) {
          console.error('Copy failed:', err);
          showToast('Failed to copy URL', 'error');
        }
      });

      buttonContainer.appendChild(downloadBtn);
      buttonContainer.appendChild(copyBtn);

      info.appendChild(titleContainer);
      info.appendChild(details);

      // Add info and button container to content wrapper
      contentWrapper.appendChild(info);
      contentWrapper.appendChild(buttonContainer);

      // Add thumbnail and content wrapper to item
      item.appendChild(thumbnail);
      item.appendChild(contentWrapper);

      return item;
    }

    async function downloadVideo(video, button) {
      // Prevent duplicate downloads of the same video
      const videoKey = video.url || video.videoId || `${video.platform}_${Date.now()}`;

      if (activeDownloads.has(videoKey)) {
        error.classList.remove('hidden');
        error.textContent = 'This video is already being downloaded. Please wait...';
        setTimeout(() => {
          error.classList.add('hidden');
        }, 3000);
        return;
      }

      // Prevent clicking disabled button
      if (button.disabled) {
        return;
      }

      try {
        // Mark this video as being downloaded
        activeDownloads.add(videoKey);
        button.disabled = true;
        button.innerHTML = '<span>Downloading...</span>';

        // Handle embedded videos (YouTube, Vimeo, etc.)
        if (video.platform) {
          // For embedded videos, open the watch page in a new tab
          // Direct download isn't always possible due to platform restrictions
          chrome.tabs.create({ url: video.url });
          button.innerHTML = '<span>Opened in Tab</span>';
          setTimeout(() => {
            activeDownloads.delete(videoKey);
            button.disabled = false;
            button.innerHTML = '<span>Open Video</span>';
          }, 2000);
          return;
        }

        // Handle blob URLs - try multiple methods to download
        if (video.isBlob) {
          const blobUrl = video.blobUrl || video.url;
          const filename = video.filename || `video_${Date.now()}.${video.extension || 'mp4'}`;

          console.log('[Video Downloader] Attempting to download blob URL:', blobUrl);

          // Get the active tab to inject download script
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

          let downloadSuccess = false;
          let lastError = null;

          // Method 1: Try to download via injected script (most reliable for blob URLs)
          try {
            console.log('[Video Downloader] Method 1: Trying script injection download...');

            // Set up a listener for progress updates from the injected script
            // This allows us to update the UI while recording
            const progressHandler = (message) => {
              if (message.type === 'RECORDING_PROGRESS' && message.videoKey === videoKey) {
                button.innerHTML = `<span>Rec: ${message.progress}% (${message.sizeMB}MB)</span>`;
              }
            };
            chrome.runtime.onMessage.addListener(progressHandler);

            const result = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: async (blobUrlToDownload, filenameToUse, videoKeyForProgress) => {
                try {
                  console.log('[Video Downloader Script] Attempting to download blob:', blobUrlToDownload);

                  let blob = null;
                  let blobSize = 0;
                  let blobType = 'video/mp4';

                  // Helper to send progress to popup
                  const sendProgress = (progress, sizeMB) => {
                    try {
                      chrome.runtime.sendMessage({
                        type: 'RECORDING_PROGRESS',
                        videoKey: videoKeyForProgress,
                        progress: progress,
                        sizeMB: sizeMB
                      });
                    } catch (e) { /* ignore */ }
                  };

                  // First, find the video element with this blob URL
                  const videos = document.querySelectorAll('video');
                  let videoElement = null;

                  for (const vid of videos) {
                    const vidSrc = vid.src || vid.currentSrc || '';
                    if (vidSrc === blobUrlToDownload || vidSrc.includes(blobUrlToDownload.split('/').pop())) {
                      videoElement = vid;
                      console.log('[Video Downloader Script] ✓ Found video element with blob URL');
                      break;
                    }
                  }

                  // Try multiple methods to get the blob
                  const methods = [];

                  // Method 1: Native Link Download (Instant)
                  // This is the fastest method if the browser allows it
                  methods.push(async () => {
                    console.log('[Video Downloader Script] Method 1: Native link download...');
                    return new Promise((resolve, reject) => {
                      try {
                        const a = document.createElement('a');
                        a.href = blobUrlToDownload;
                        a.download = filenameToUse;
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();

                        // We can't easily detect if this worked, so we'll 
                        // also try fetch in parallel or sequence.
                        // Actually, we'll wait a brief moment and then "succeed" 
                        // if we think it worked, but better to use fetch for verification.
                        document.body.removeChild(a);

                        // Move to next method for actual data verification
                        reject(new Error('Native link triggered, verifying with fetch...'));
                      } catch (e) {
                        reject(e);
                      }
                    });
                  });

                  // Method 2: Direct fetch (try without CORS restrictions first)
                  methods.push(async () => {
                    console.log('[Video Downloader Script] Method 2: Direct fetch...');
                    const response = await fetch(blobUrlToDownload);
                    if (response.ok) {
                      const fetchedBlob = await response.blob();
                      if (fetchedBlob.size > 1024) { // Re-check size here
                        return fetchedBlob;
                      }
                    }
                    throw new Error(`Fetch failed or empty: ${response.status}`);
                  });

                  // Method 2: Fetch from video element src
                  if (videoElement) {
                    methods.push(async () => {
                      console.log('[Video Downloader Script] Method 2: Fetch from video element...');
                      const videoSrc = videoElement.src || videoElement.currentSrc;
                      if (videoSrc && videoSrc.startsWith('blob:')) {
                        const response = await fetch(videoSrc);
                        if (response.ok) {
                          const fetchedBlob = await response.blob();
                          if (fetchedBlob.size > 0) {
                            return fetchedBlob;
                          }
                        }
                      }
                      throw new Error('Video element fetch failed');
                    });
                  }

                  // Method 3: XMLHttpRequest
                  methods.push(async () => {
                    console.log('[Video Downloader Script] Method 3: XMLHttpRequest...');
                    return new Promise((resolve, reject) => {
                      const xhr = new XMLHttpRequest();
                      xhr.open('GET', blobUrlToDownload, true);
                      xhr.responseType = 'blob';

                      xhr.onload = function () {
                        if ((xhr.status === 200 || xhr.status === 0) && xhr.response && xhr.response.size > 0) {
                          resolve(xhr.response);
                        } else {
                          reject(new Error(`XHR failed: status ${xhr.status}, size ${xhr.response?.size || 0}`));
                        }
                      };

                      xhr.onerror = function () {
                        reject(new Error('XHR network error'));
                      };

                      xhr.ontimeout = function () {
                        reject(new Error('XHR timeout'));
                      };

                      xhr.timeout = 30000; // 30 second timeout
                      xhr.send();
                    });
                  });

                  // Method 4: Use MediaRecorder to capture video from memory
                  if (videoElement) {
                    methods.push(async () => {
                      console.log('[Video Downloader Script] Method 4: MediaRecorder capture from memory...');

                      return new Promise((resolve, reject) => {
                        try {
                          // Ensure video has loaded data
                          if (videoElement.readyState < 2) {
                            throw new Error('Video not ready for capture (readyState < 2)');
                          }

                          // Capture the video stream from memory
                          const stream = videoElement.captureStream ? videoElement.captureStream() : videoElement.mozCaptureStream();
                          if (!stream) throw new Error('Could not capture video stream');

                          const chunks = [];
                          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

                          recorder.ondataavailable = (e) => {
                            if (e.data?.size > 0) {
                              chunks.push(e.data);
                              console.log(`[Video Downloader Script] Captured chunk: ${e.data.size} bytes`);
                            }
                          };

                          recorder.onstop = () => {
                            const blob = new Blob(chunks, { type: 'video/webm' });
                            console.log(`[Video Downloader Script] MediaRecorder finished. Total size: ${blob.size} bytes from ${chunks.length} chunks`);
                            blob.size > 0 ? resolve(blob) : reject(new Error('Captured video is empty'));
                          };

                          recorder.onerror = (e) => reject(new Error(`MediaRecorder error: ${e.error}`));

                          // Store original state
                          const wasPlaying = !videoElement.paused;
                          const originalTime = videoElement.currentTime;

                          // Reset video to beginning for full capture
                          videoElement.currentTime = 0;

                          // Start recording and play the video
                          recorder.start(1000); // Request data every 1 second
                          console.log('[Video Downloader Script] MediaRecorder started, playing video from beginning...');

                          // Play the video to capture it
                          const playPromise = videoElement.play();
                          if (playPromise) {
                            playPromise.catch(err => {
                              console.warn('[Video Downloader Script] Play failed:', err);
                            });
                          }

                          // Calculate duration to record (max 15 minutes for safety)
                          // Support for longer videos (up to 15 minutes = 900 seconds)
                          const MAX_RECORDING_MS = 15 * 60 * 1000; // 15 minutes in milliseconds
                          const duration = videoElement.duration && isFinite(videoElement.duration)
                            ? Math.min(videoElement.duration * 1000, MAX_RECORDING_MS)
                            : 10000; // Default 10 seconds if duration unknown

                          console.log(`[Video Downloader Script] Recording for ${(duration / 1000).toFixed(1)}s (video duration: ${videoElement.duration}s, max: ${MAX_RECORDING_MS / 1000}s)`);

                          // Return a promise that includes progress tracking
                          const startTime = Date.now();
                          const progressInterval = setInterval(() => {
                            const elapsed = Date.now() - startTime;
                            const progress = Math.min(Math.round((elapsed / duration) * 100), 99);
                            const totalChunksSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
                            const sizeMB = (totalChunksSize / 1024 / 1024).toFixed(1);
                            console.log(`[Video Downloader Script] Recording progress: ${progress}% (${sizeMB} MB captured)`);

                            // Send progress update back to popup
                            sendProgress(progress, sizeMB);
                          }, 2000); // Update every 2 seconds

                          // Stop recording after video duration
                          setTimeout(() => {
                            clearInterval(progressInterval);
                            if (recorder.state !== 'inactive') {
                              recorder.stop();
                              console.log('[Video Downloader Script] Stopping MediaRecorder after duration');
                            }

                            // Restore original state
                            videoElement.pause();
                            videoElement.currentTime = originalTime;
                            if (wasPlaying) {
                              videoElement.play().catch(() => { });
                            }
                          }, duration + 500); // Add small buffer

                        } catch (error) {
                          reject(error);
                        }
                      });
                    });
                  }

                  // Try all methods in sequence
                  let lastError = null;
                  for (let i = 0; i < methods.length; i++) {
                    try {
                      blob = await methods[i]();
                      blobSize = blob.size;
                      blobType = blob.type || 'video/mp4';
                      console.log(`[Video Downloader Script] ✓ Method ${i + 1} succeeded! Size: ${blobSize}, Type: ${blobType}`);
                      break;
                    } catch (methodError) {
                      console.log(`[Video Downloader Script] Method ${i + 1} failed:`, methodError.message);
                      lastError = methodError;
                      continue;
                    }
                  }

                  if (!blob || blob.size === 0) {
                    throw new Error(lastError?.message || 'Blob is empty or could not be retrieved (0 bytes). All methods failed.');
                  }

                  // CRITICAL: Validate blob size - files < 1KB are likely error responses, not actual videos
                  const MIN_VIDEO_SIZE = 1024; // 1KB minimum
                  if (blob.size < MIN_VIDEO_SIZE) {
                    console.warn(`[Video Downloader Script] ⚠ Blob size (${blob.size} bytes) is suspiciously small. This is likely an error response, not a video.`);
                    throw new Error(`Downloaded blob is too small (${blob.size} bytes). This appears to be an error response rather than actual video content. The blob URL may be expired or invalid.`);
                  }

                  console.log('[Video Downloader Script] ✓ Blob ready. Size:', blobSize, 'Type:', blobType);

                  // Create object URL from the blob
                  const objectUrl = URL.createObjectURL(blob);
                  console.log('[Video Downloader Script] Created object URL for download');

                  // Create download link and trigger it
                  const a = document.createElement('a');
                  a.href = objectUrl;
                  a.download = filenameToUse;
                  a.style.display = 'none';
                  a.setAttribute('download', filenameToUse); // Ensure download attribute is set

                  // Add to body
                  document.body.appendChild(a);

                  console.log('[Video Downloader Script] Triggering download click...');

                  // Use multiple methods to trigger download
                  // Method 1: Direct click
                  a.click();

                  // Method 2: Dispatch mouse event (more reliable)
                  const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                  });
                  a.dispatchEvent(clickEvent);

                  // Wait a moment to ensure download starts
                  await new Promise(resolve => setTimeout(resolve, 1000));

                  // Clean up element
                  document.body.removeChild(a);

                  // Don't revoke object URL immediately - let download complete
                  setTimeout(() => {
                    URL.revokeObjectURL(objectUrl);
                    console.log('[Video Downloader Script] Cleaned up object URL');
                  }, 30000); // Longer timeout for large files

                  return { success: true, blobSize: blobSize, blobType: blobType };
                } catch (err) {
                  console.error('[Video Downloader Script] All download methods failed:', err);
                  console.error('[Video Downloader Script] Error details:', {
                    message: err.message,
                    stack: err.stack,
                    name: err.name
                  });
                  return { success: false, error: err.message, stack: err.stack };
                }
              },
              args: [blobUrl, filename, videoKey]
            });

            // Clean up the progress listener
            chrome.runtime.onMessage.removeListener(progressHandler);

            const downloadResult = result[0]?.result;
            console.log('[Video Downloader] Download result:', downloadResult);

            if (downloadResult && downloadResult.success) {
              downloadSuccess = true;
              activeDownloads.delete(videoKey);
              button.innerHTML = '<span>Downloaded!</span>';
              error.classList.remove('hidden');
              error.style.background = 'linear-gradient(135deg, #34a853 0%, #2d8f47 100%)';
              // Format bytes for display
              const formatBytes = (bytes) => {
                if (!bytes || isNaN(bytes)) return 'Unknown';
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                if (bytes === 0) return '0 Bytes';
                const i = Math.floor(Math.log(bytes) / Math.log(1024));
                return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
              };
              error.textContent = `✓ Download started! File size: ${downloadResult.blobSize ? formatBytes(downloadResult.blobSize) : 'unknown'}`;
              setTimeout(() => {
                error.classList.add('hidden');
                error.style.background = ''; // Reset
              }, 3000);
              setTimeout(() => {
                button.disabled = false;
                button.innerHTML = '<span>Download</span>';
              }, 2000);
            } else {
              lastError = new Error(downloadResult?.error || 'Script injection download failed');
              console.error('[Video Downloader] Method 1 failed:', lastError.message);
            }
          } catch (scriptError) {
            lastError = scriptError;
            console.error('[Video Downloader] Script injection error:', scriptError);
          }

          // Note: Chrome downloads API doesn't work for blob URLs, so we skip Method 2
          // The script injection method (Method 1) is the only reliable way for blob URLs

          // If download failed, show error with retry option
          if (!downloadSuccess) {
            console.error('[Video Downloader] Download failed. Last error:', lastError);

            activeDownloads.delete(videoKey);
            button.disabled = false;
            button.innerHTML = '<span>Retry Download</span>';

            error.classList.remove('hidden');
            if (lastError?.message?.includes('too small')) {
              error.textContent = `Download failed: The video source is protected or no longer available as a direct file. Try refreshing the page.`;
            } else {
              error.textContent = `Download failed: ${lastError?.message || 'Unknown error'}\n\nNote: Some videos are "streaming only" and must be recorded by playing them. If recording failed, try playing the video for a few seconds first.`;
            }
            error.style.whiteSpace = 'pre-wrap';
            error.style.fontSize = '12px';
            error.style.padding = '16px 20px';

            setTimeout(() => {
              error.classList.add('hidden');
              error.style.whiteSpace = '';
              error.style.fontSize = '';
              error.style.padding = '';
              button.innerHTML = '<span>Download</span>';
            }, 10000);
          }

          return;
        }

        // For direct video URLs, use Chrome downloads API
        // Each video gets a unique filename with timestamp to prevent conflicts
        const timestamp = Date.now();
        const filename = video.filename
          ? video.filename.replace(/\.[^/.]+$/, '') + '_' + timestamp + '.' + (video.extension || 'mp4')
          : `video_${timestamp}.${video.extension || 'mp4'}`;

        // Start the download - each video downloads independently
        const downloadId = await chrome.downloads.download({
          url: video.url,
          filename: filename,
          saveAs: false
        });

        // Monitor download progress for this specific video
        const onDownloadChanged = (downloadDelta) => {
          if (downloadDelta.id === downloadId) {
            if (downloadDelta.state && downloadDelta.state.current === 'complete') {
              // Download completed successfully
              activeDownloads.delete(videoKey);
              button.innerHTML = '<span>Downloaded!</span>';
              setTimeout(() => {
                button.disabled = false;
                button.innerHTML = '<span>Download</span>';
              }, 2000);
              chrome.downloads.onChanged.removeListener(onDownloadChanged);
            } else if (downloadDelta.state && downloadDelta.state.current === 'interrupted') {
              // Download failed or was interrupted
              activeDownloads.delete(videoKey);
              button.disabled = false;
              button.innerHTML = '<span>Download</span>';
              error.classList.remove('hidden');
              error.textContent = 'Download was interrupted. Please try again.';
              setTimeout(() => {
                error.classList.add('hidden');
              }, 3000);
              chrome.downloads.onChanged.removeListener(onDownloadChanged);
            }
          }
        };

        chrome.downloads.onChanged.addListener(onDownloadChanged);

        // Fallback: remove from active downloads after 60 seconds if no update
        setTimeout(() => {
          if (activeDownloads.has(videoKey)) {
            activeDownloads.delete(videoKey);
            if (button.disabled && button.innerHTML.includes('Downloading')) {
              button.disabled = false;
              button.innerHTML = '<span>Download</span>';
            }
          }
        }, 60000);

      } catch (err) {
        activeDownloads.delete(videoKey);
        button.disabled = false;
        if (video.platform) {
          button.innerHTML = '<span>Open Video</span>';
        } else {
          button.innerHTML = '<span>Download</span>';
        }
        error.classList.remove('hidden');
        error.textContent = `Download failed: ${err.message}`;
        setTimeout(() => {
          error.classList.add('hidden');
        }, 5000);
      }
    }
  } catch (err) {
    console.error('[Video Downloader] Error initializing popup:', err);
    // Try to show error in popup
    const errorEl = document.getElementById('error');
    if (errorEl) {
      errorEl.classList.remove('hidden');
      errorEl.textContent = `Extension Error: ${err.message}. Please check the console (F12) for details.`;
    } else {
      // If error element doesn't exist, show alert
      alert(`Extension Error: ${err.message}. Please check the console (F12) for details.`);
    }
  }
});

// Function to scan with retry for dynamic content (React/SPA)
// This function is injected into the page context
// CRITICAL FIX: scanForVideos must be included inline or injected separately
// Since we can't pass functions as arguments, we'll inject scanForVideos first
// and have it assign itself to window, then this function will use window.scanForVideos
async function scanForVideosWithRetry() {
  try {
    console.log('[Video Downloader] scanForVideosWithRetry started on:', window.location.href);

    // Get scanForVideos from window (should be set by previous injection)
    // Use a different variable name to avoid any closure issues with outer scope
    const scanFunc = window.scanForVideos;

    if (!scanFunc || typeof scanFunc !== 'function') {
      // scanForVideos not in window - this means the previous injection failed
      // or scanForVideos wasn't injected yet
      console.error('[Video Downloader] scanForVideos not found in window.scanForVideos');
      console.error('[Video Downloader] Available in window:', Object.keys(window).filter(k => k.includes('scan')));
      throw new Error('scanForVideos function not available in window. The extension may need to be reloaded, or there was an error injecting scanForVideos.');
    }

    // Wait a bit for React/SPA to render (shorter wait for file:// pages)
    const isFileProtocol = window.location.protocol === 'file:';
    await new Promise(resolve => setTimeout(resolve, isFileProtocol ? 100 : 500));

    // First scan - use scanFunc (which is window.scanForVideos)
    console.log('[Video Downloader] Starting first scan...');
    console.log('[Video Downloader] scanFunc type:', typeof scanFunc);
    let videos = await scanFunc();
    console.log('[Video Downloader] First scan completed, found:', videos?.length || 0, 'videos');

    // Ensure videos is an array
    if (!Array.isArray(videos)) {
      console.error('[Video Downloader] scanFunc did not return an array:', videos);
      videos = [];
    }

    // If no videos found, wait more and scan again (for slow-loading SPAs)
    if (videos.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const newVideos = await scanFunc();
      if (Array.isArray(newVideos)) {
        videos = newVideos;
      }
    }

    // If still no videos, wait one more time (some SPAs take longer)
    if (videos.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const newVideos = await scanFunc();
      if (Array.isArray(newVideos)) {
        videos = newVideos;
      }
    }

    // Use MutationObserver to watch for dynamically added videos
    return new Promise((resolve) => {
      let resolved = false;

      const observer = new MutationObserver(async () => {
        if (resolved) return;
        try {
          // Use window.scanForVideos directly to avoid closure issues
          const newVideos = await window.scanForVideos();
          if (Array.isArray(newVideos) && newVideos.length > videos.length) {
            videos = newVideos;
            resolved = true;
            observer.disconnect();
            resolve(videos);
          }
        } catch (err) {
          // If scan fails, just resolve with what we have
          if (!resolved) {
            resolved = true;
            observer.disconnect();
            resolve(videos);
          }
        }
      });

      // Observe the entire document for changes
      if (document.body || document.documentElement) {
        observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: [
            'src', 'poster', 'data-src', 'data-video-src', 'data-video-url',
            'data-video', 'data-file', 'data-source', 'data-url',
            'data-mp4', 'data-webm', 'data-ogg', 'href', 'data',
            'data-original-src', 'data-lazy-src', 'data-srcset'
          ]
        });
      }

      // Resolve after a timeout to prevent waiting forever
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          observer.disconnect();
          resolve(Array.isArray(videos) ? videos : []);
        }
      }, 3000);

      // If we already have videos, resolve after a short delay
      if (videos.length > 0) {
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            observer.disconnect();
            resolve(Array.isArray(videos) ? videos : []);
          }
        }, 200);
      }
    });
  } catch (err) {
    // If anything fails, log and return empty array
    console.error('[Video Downloader] Error in scanForVideosWithRetry:', err);
    console.error('[Video Downloader] Error stack:', err.stack);
    return [];
  }
}

// Function to be injected into the page
async function scanForVideos() {
  // CRITICAL: Assign this function to window BEFORE executing
  // This allows scanForVideosWithRetry to access it
  if (typeof window !== 'undefined') {
    window.scanForVideos = scanForVideos;
    console.log('[Video Downloader] scanForVideos assigned to window, type:', typeof window.scanForVideos);
  }

  // Helper functions (defined inside to be serialized together)
  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  function getExtension(url) {
    try {
      const pathname = new URL(url).pathname;
      const match = pathname.match(/\.([a-z0-9]+)$/i);
      return match ? match[1] : 'mp4';
    } catch {
      return 'mp4';
    }
  }

  function getFilename(url) {
    try {
      const pathname = new URL(url).pathname;
      const filename = pathname.split('/').pop();
      return filename || `video_${Date.now()}.${getExtension(url)}`;
    } catch {
      return `video_${Date.now()}.${getExtension(url)}`;
    }
  }

  const videos = [];
  const allVideoElements = new Set();
  const networkUrls = new Set();

  // --- Network Hunter ---
  // Try to find the original source URLs of videos that might be hidden as blobs
  try {
    // 1. Scan Performance Resource Timing API
    if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
      const resources = performance.getEntriesByType('resource');
      resources.forEach(res => {
        const url = res.name;
        const type = res.initiatorType;
        // Look for video extensions or common video patterns in URLs
        if (url.match(/\.(mp4|webm|ogg|mov|m4s|m3u8|ts)(\?|$)/i) ||
          url.includes('video/') ||
          url.includes('/media/')) {
          if (!url.startsWith('blob:') && !url.startsWith('data:')) {
            networkUrls.add(url);
          }
        }
      });
    }

    // 2. Scan Script Tags for Video URLs
    document.querySelectorAll('script').forEach(script => {
      const content = script.textContent || script.innerHTML;
      if (!content || content.length < 20) return;

      // Match common video URL patterns in JS strings
      const patterns = [
        /['"](https?:\/\/[^'"]+\.(?:mp4|webm|ogg|mov|m3u8|mpd)[^'"]*)['"]/gi,
        /['"](https?:\/\/[^'"]+video[^'"]*)['"]/gi
      ];

      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const url = match[1].replace(/\\/g, ''); // Unescape slashes
          if (url && !url.startsWith('blob:') && !url.startsWith('data:')) {
            networkUrls.add(url);
          }
        }
      });
    });

    console.log(`[Video Downloader Hunter] Found ${networkUrls.size} potential raw video URLs in network/scripts`);
  } catch (hunterError) {
    console.warn('[Video Downloader Hunter] Error hunting for network URLs:', hunterError);
  }

  // Detect YouTube watch page (when user is on youtube.com/watch) - DO THIS FIRST
  try {
    const currentUrl = window.location.href;
    if (currentUrl.includes('youtube.com/watch') || currentUrl.includes('youtu.be/')) {
      let videoId = null;

      // Extract video ID from URL - handle both watch and short URLs
      const youtubeWatchRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^"&?\/\s]{11})/;
      const match = currentUrl.match(youtubeWatchRegex);
      if (match && match[1]) {
        videoId = match[1];
      }

      if (videoId) {
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

        // Try to get video title from page
        let title = 'YouTube Video';
        try {
          // Try multiple selectors for YouTube title (updated for current YouTube UI)
          const titleSelectors = [
            'h1.ytd-watch-metadata yt-formatted-string',
            'h1 yt-formatted-string',
            'h1.title',
            '.watch-main-col h1',
            'meta[property="og:title"]',
            'meta[name="title"]',
            'title'
          ];

          for (const selector of titleSelectors) {
            try {
              const element = document.querySelector(selector);
              if (element) {
                const text = element.textContent?.trim() ||
                  element.getAttribute('content') ||
                  element.innerText?.trim() ||
                  '';
                if (text && text !== 'YouTube' && text.length > 3) {
                  title = text;
                  break;
                }
              }
            } catch (selectorError) {
              // Continue to next selector
              continue;
            }
          }

          // Clean up title (remove " - YouTube" suffix if present)
          title = title.replace(/\s*-\s*YouTube\s*$/i, '').trim();
          if (!title || title.length < 3) {
            title = `YouTube Video ${videoId.substring(0, 8)}`;
          }
        } catch (e) {
          title = `YouTube Video ${videoId.substring(0, 8)}`;
        }

        const videoInfo = {
          url: watchUrl,
          downloadUrl: watchUrl,
          title: title,
          width: null,
          height: null,
          duration: null,
          thumbnail: thumbnail,
          extension: 'mp4',
          filename: `youtube_${videoId}.mp4`,
          platform: 'youtube',
          videoId: videoId,
          size: 'Unknown' // Set size immediately for platform videos
        };
        videos.push(videoInfo);
        console.log('[Video Downloader] YouTube video detected:', videoId, title);
      }
    }
  } catch (e) {
    // If detection fails, log but continue with other methods
    console.error('[Video Downloader] YouTube watch page detection failed:', e);
  }

  // Helper function to find videos in shadow DOM
  function findVideosInShadowDOM(root) {
    const found = [];
    try {
      // Check if root has shadowRoot
      if (root.shadowRoot) {
        const shadowVideos = root.shadowRoot.querySelectorAll('video, source[type*="video"]');
        shadowVideos.forEach(v => {
          found.push(v);
          allVideoElements.add(v);
        });

        // Recursively check shadow DOM children
        root.shadowRoot.querySelectorAll('*').forEach(child => {
          if (child.shadowRoot) {
            found.push(...findVideosInShadowDOM(child));
          }
        });
      }
    } catch (e) {
      // Some shadow DOMs may not be accessible
    }
    return found;
  }

  // Collect all regular video elements
  document.querySelectorAll('video, source[type*="video"]').forEach(el => {
    allVideoElements.add(el);
  });

  // Find videos in shadow DOM
  document.querySelectorAll('*').forEach(element => {
    if (element.shadowRoot) {
      findVideosInShadowDOM(element);
    }
  });

  // Process <video> elements (including those from shadow DOM)
  // Also check all video elements directly (not just from Set)
  const allVideos = new Set();
  document.querySelectorAll('video').forEach(v => allVideos.add(v));
  Array.from(allVideoElements).filter(el => el.tagName === 'VIDEO').forEach(v => allVideos.add(v));

  Array.from(allVideos).forEach((video, index) => {
    const sources = [];

    // Get src attribute
    if (video.src) {
      sources.push(video.src);
    }

    // Get source elements
    video.querySelectorAll('source').forEach(source => {
      if (source.src) {
        sources.push(source.src);
      }
    });

    // If no sources found but video element exists, still add it
    if (sources.length === 0 && video) {
      // Video element exists but has no src - might be dynamically loaded
      // Check for data attributes
      const dataSrc = video.getAttribute('data-src') ||
        video.getAttribute('data-video-src') ||
        video.getAttribute('data-video-url');
      if (dataSrc) {
        sources.push(dataSrc);
      }
    }

    sources.forEach(src => {
      if (src) {
        // Extract video name from multiple sources
        const videoName = video.getAttribute('title') ||
          video.getAttribute('aria-label') ||
          video.getAttribute('alt') ||
          video.getAttribute('data-name') ||
          video.getAttribute('data-title') ||
          video.closest('[data-video-title]')?.getAttribute('data-video-title') ||
          video.closest('figure')?.querySelector('figcaption')?.textContent?.trim() ||
          video.closest('.video-title')?.textContent?.trim() ||
          video.closest('.video-container')?.querySelector('h2, h3, .title')?.textContent?.trim() ||
          `Video ${videos.length + 1}`;

        // Extract alt text
        const altText = video.getAttribute('alt') ||
          video.getAttribute('aria-label') ||
          video.getAttribute('title') ||
          null;

        // Check if this is a blob URL - include it and allow download attempt
        const isBlob = src.startsWith('blob:');
        const isData = src.startsWith('data:');
        let actualUrl = src;
        let canDownload = true; // Allow trying to download blob URLs

        // Try to find original source in data attributes or parent elements
        if (isBlob) {
          // Look for original source in various places
          const originalSrc = video.getAttribute('data-src') ||
            video.getAttribute('data-original-src') ||
            video.getAttribute('data-video-url') ||
            video.closest('[data-video-src]')?.getAttribute('data-video-src') ||
            video.closest('[data-src]')?.getAttribute('data-src') ||
            null;

          if (originalSrc && !originalSrc.startsWith('blob:') && !originalSrc.startsWith('data:')) {
            actualUrl = originalSrc;
            canDownload = true;
          } else {
            // Use blob URL - can try to download it (may work if blob is still valid)
            actualUrl = src;
            canDownload = true; // Allow trying to download blob URLs
          }
        } else if (isData) {
          canDownload = false; // Data URLs are too large to download
        }

        // Include blob URLs - don't filter them out
        // Always include the video, even if it's a blob URL
        const videoInfo = {
          url: actualUrl,
          blobUrl: isBlob ? src : null,
          title: videoName,
          altText: altText,
          width: video.videoWidth || video.getAttribute('width') || null,
          height: video.videoHeight || video.getAttribute('height') || null,
          duration: video.duration ? formatDuration(video.duration) : null,
          thumbnail: video.poster || null,
          extension: isBlob ? 'mp4' : getExtension(actualUrl),
          filename: isBlob ? `video_${Date.now()}_${videoName.substring(0, 20).replace(/[^a-z0-9]/gi, '_')}.mp4` : getFilename(actualUrl),
          isBlob: isBlob,
          canDownload: canDownload
        };

        // Always push blob URLs - they should be included
        videos.push(videoInfo);
      }
    });
  });

  // Process <source> elements that are NOT already processed (standalone or in videos without src)
  // Skip sources that are children of videos we already processed (to avoid duplicates)
  document.querySelectorAll('source[type*="video"]').forEach(source => {
    if (source.src && !source.src.startsWith('data:')) {
      const parent = source.closest('video');

      // Skip if this source's parent video was already processed with this source
      // (We check if the video already has this source in our videos array)
      const alreadyProcessed = parent && videos.some(v => {
        // Check if we already have a video with this URL from the same parent
        return v.url === source.src && v.title && v.title.includes('Video');
      });

      if (!alreadyProcessed) {
        // Extract video name from multiple sources
        const videoName = parent ? (
          parent.getAttribute('title') ||
          parent.getAttribute('aria-label') ||
          parent.getAttribute('alt') ||
          parent.getAttribute('data-name') ||
          parent.getAttribute('data-title') ||
          parent.closest('[data-video-title]')?.getAttribute('data-video-title') ||
          parent.closest('figure')?.querySelector('figcaption')?.textContent?.trim() ||
          parent.closest('.video-title')?.textContent?.trim() ||
          parent.closest('.video-container')?.querySelector('h2, h3, .title')?.textContent?.trim() ||
          `Video ${videos.length + 1}`
        ) : `Video ${videos.length + 1}`;

        // Extract alt text
        const altText = parent ? (
          parent.getAttribute('alt') ||
          parent.getAttribute('aria-label') ||
          parent.getAttribute('title') ||
          null
        ) : null;

        const isBlob = source.src.startsWith('blob:');
        const isData = source.src.startsWith('data:');
        let actualUrl = source.src;
        let canDownload = !isBlob && !isData;

        // Try to find original source
        if (isBlob && parent) {
          const originalSrc = parent.getAttribute('data-src') ||
            parent.getAttribute('data-original-src') ||
            parent.getAttribute('data-video-url') ||
            null;
          if (originalSrc && !originalSrc.startsWith('blob:') && !originalSrc.startsWith('data:')) {
            actualUrl = originalSrc;
            canDownload = true;
          } else {
            // Use blob URL
            actualUrl = source.src;
            canDownload = true; // Allow trying blob URLs
          }
        }

        const videoInfo = {
          url: actualUrl,
          blobUrl: isBlob ? source.src : null,
          title: videoName,
          altText: altText,
          width: parent ? (parent.videoWidth || parent.getAttribute('width') || null) : null,
          height: parent ? (parent.videoHeight || parent.getAttribute('height') || null) : null,
          duration: parent && parent.duration ? formatDuration(parent.duration) : null,
          thumbnail: parent ? parent.poster : null,
          extension: isBlob ? 'mp4' : getExtension(actualUrl),
          filename: isBlob ? `video_${Date.now()}.mp4` : getFilename(actualUrl),
          isBlob: isBlob,
          canDownload: canDownload
        };
        videos.push(videoInfo);
      }
    }
  });

  // Detect YouTube videos in iframes
  document.querySelectorAll('iframe').forEach(iframe => {
    const src = iframe.src || iframe.getAttribute('data-src') || '';

    // YouTube detection
    if (src.includes('youtube.com') || src.includes('youtu.be') || src.includes('youtube-nocookie.com')) {
      let videoId = null;

      // Extract video ID from various YouTube URL formats
      const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
      const match = src.match(youtubeRegex);
      if (match && match[1]) {
        videoId = match[1];
      }

      // Also check for embed format
      if (!videoId) {
        const embedMatch = src.match(/embed\/([^"&?\/\s]{11})/);
        if (embedMatch && embedMatch[1]) {
          videoId = embedMatch[1];
        }
      }

      if (videoId) {
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

        // Try to get title from iframe or parent
        const title = iframe.getAttribute('title') ||
          iframe.getAttribute('aria-label') ||
          iframe.closest('[title]')?.getAttribute('title') ||
          `YouTube Video ${videoId.substring(0, 8)}`;

        const videoInfo = {
          url: watchUrl,
          downloadUrl: watchUrl, // For embedded videos, we'll open the watch page
          title: title,
          width: iframe.width || iframe.getAttribute('width') || null,
          height: iframe.height || iframe.getAttribute('height') || null,
          duration: null, // YouTube API would be needed for this
          thumbnail: thumbnail,
          extension: 'mp4',
          filename: `youtube_${videoId}.mp4`,
          platform: 'youtube',
          videoId: videoId
        };
        videos.push(videoInfo);
      }
    }

    // Vimeo detection
    else if (src.includes('vimeo.com')) {
      const vimeoRegex = /vimeo\.com\/(?:video\/)?(\d+)/;
      const match = src.match(vimeoRegex);
      if (match && match[1]) {
        const videoId = match[1];
        const watchUrl = `https://vimeo.com/${videoId}`;

        const title = iframe.getAttribute('title') ||
          iframe.getAttribute('aria-label') ||
          iframe.closest('[title]')?.getAttribute('title') ||
          `Vimeo Video ${videoId}`;

        const videoInfo = {
          url: watchUrl,
          downloadUrl: watchUrl,
          title: title,
          width: iframe.width || iframe.getAttribute('width') || null,
          height: iframe.height || iframe.getAttribute('height') || null,
          duration: null,
          thumbnail: null, // Vimeo thumbnails require API
          extension: 'mp4',
          filename: `vimeo_${videoId}.mp4`,
          platform: 'vimeo',
          videoId: videoId
        };
        videos.push(videoInfo);
      }
    }

    // Dailymotion detection
    else if (src.includes('dailymotion.com')) {
      const dailymotionRegex = /dailymotion\.com\/(?:embed\/)?video\/([^"&?\/\s]+)/;
      const match = src.match(dailymotionRegex);
      if (match && match[1]) {
        const videoId = match[1];
        const watchUrl = `https://www.dailymotion.com/video/${videoId}`;

        const title = iframe.getAttribute('title') ||
          iframe.getAttribute('aria-label') ||
          `Dailymotion Video ${videoId.substring(0, 8)}`;

        const videoInfo = {
          url: watchUrl,
          downloadUrl: watchUrl,
          title: title,
          width: iframe.width || iframe.getAttribute('width') || null,
          height: iframe.height || iframe.getAttribute('height') || null,
          duration: null,
          thumbnail: `https://www.dailymotion.com/thumbnail/video/${videoId}`,
          extension: 'mp4',
          filename: `dailymotion_${videoId}.mp4`,
          platform: 'dailymotion',
          videoId: videoId
        };
        videos.push(videoInfo);
      }
    }

    // Generic video iframe detection (look for common video hosting patterns)
    else if (src.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)) {
      // Direct video file in iframe
      const title = iframe.getAttribute('title') ||
        iframe.getAttribute('aria-label') ||
        `Video ${videos.length + 1}`;

      const videoInfo = {
        url: src,
        title: title,
        width: iframe.width || iframe.getAttribute('width') || null,
        height: iframe.height || iframe.getAttribute('height') || null,
        duration: null,
        thumbnail: null,
        extension: getExtension(src),
        filename: getFilename(src)
      };
      videos.push(videoInfo);
    }
  });

  // Detect video URLs in data attributes and links
  document.querySelectorAll('[data-video-url], [data-src*="video"], a[href*=".mp4"], a[href*=".webm"]').forEach(element => {
    let videoUrl = element.getAttribute('data-video-url') ||
      element.getAttribute('data-src') ||
      element.getAttribute('data-video-src') ||
      element.getAttribute('data-srcset')?.split(',')[0]?.trim() ||
      (element.tagName === 'A' ? element.href : null);

    if (videoUrl && (videoUrl.includes('.mp4') || videoUrl.includes('.webm') || videoUrl.includes('.ogg') || videoUrl.includes('.mov'))) {
      const title = element.getAttribute('title') ||
        element.getAttribute('aria-label') ||
        element.getAttribute('data-title') ||
        element.textContent.trim() ||
        `Video ${videos.length + 1}`;

      const videoInfo = {
        url: videoUrl,
        title: title.length > 50 ? title.substring(0, 50) + '...' : title,
        width: null,
        height: null,
        duration: null,
        thumbnail: element.getAttribute('data-poster') || element.getAttribute('data-thumbnail') || null,
        extension: getExtension(videoUrl),
        filename: getFilename(videoUrl)
      };
      videos.push(videoInfo);
    }
  });

  // Look for video URLs in React props and other data attributes
  document.querySelectorAll('[data-video], [data-src], [src*="video"], [href*="video"]').forEach(element => {
    const attrs = ['data-video', 'data-src', 'data-video-src', 'src', 'href'];
    attrs.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value && (value.includes('.mp4') || value.includes('.webm') || value.includes('.ogg') || value.includes('.mov') || value.includes('video'))) {
        // Check if this video is already in our list
        const alreadyAdded = videos.some(v => v.url === value);
        if (!alreadyAdded && !value.startsWith('blob:') && !value.startsWith('data:')) {
          const title = element.getAttribute('title') ||
            element.getAttribute('aria-label') ||
            element.getAttribute('data-title') ||
            element.closest('[data-title]')?.getAttribute('data-title') ||
            element.textContent.trim() ||
            `Video ${videos.length + 1}`;

          const videoInfo = {
            url: value,
            title: title.length > 50 ? title.substring(0, 50) + '...' : title,
            width: element.getAttribute('width') || null,
            height: element.getAttribute('height') || null,
            duration: null,
            thumbnail: element.getAttribute('data-poster') || element.getAttribute('poster') || null,
            extension: getExtension(value),
            filename: getFilename(value)
          };
          videos.push(videoInfo);
        }
      }
    });
  });

  // Detect videos in <object> and <embed> elements
  document.querySelectorAll('object, embed').forEach(element => {
    const src = element.getAttribute('data') || element.getAttribute('src') || element.getAttribute('data-src');
    if (src && (src.includes('.mp4') || src.includes('.webm') || src.includes('.ogg') || src.includes('.mov') || src.match(/video/i))) {
      const alreadyAdded = videos.some(v => v.url === src);
      if (!alreadyAdded && !src.startsWith('blob:') && !src.startsWith('data:')) {
        const title = element.getAttribute('title') ||
          element.getAttribute('aria-label') ||
          element.closest('[title]')?.getAttribute('title') ||
          `Video ${videos.length + 1}`;

        const videoInfo = {
          url: src,
          title: title,
          width: element.getAttribute('width') || null,
          height: element.getAttribute('height') || null,
          duration: null,
          thumbnail: null,
          extension: getExtension(src),
          filename: getFilename(src)
        };
        videos.push(videoInfo);
      }
    }
  });

  // Detect videos in Video.js player instances
  try {
    if (window.videojs && typeof window.videojs.getPlayers === 'function') {
      const players = window.videojs.getPlayers();
      Object.keys(players).forEach(playerId => {
        const player = players[playerId];
        if (player.src) {
          const src = typeof player.src === 'string' ? player.src : (player.src().src || player.src().url);
          if (src && !videos.some(v => v.url === src)) {
            const videoInfo = {
              url: src,
              title: player.title || `Video.js Player ${playerId}`,
              width: player.width() || null,
              height: player.height() || null,
              duration: player.duration() ? formatDuration(player.duration()) : null,
              thumbnail: player.poster() || null,
              extension: getExtension(src),
              filename: getFilename(src)
            };
            videos.push(videoInfo);
          }
        }
      });
    }
  } catch (e) {
    // Video.js not available or error accessing
  }

  // Detect videos in Plyr player instances
  try {
    if (window.Plyr) {
      document.querySelectorAll('.plyr').forEach(plyrElement => {
        try {
          const player = window.Plyr.get(plyrElement);
          if (player && player.source) {
            const source = player.source;
            const src = source.sources && source.sources[0] ? source.sources[0].src : (source.src || source.url);
            if (src && !videos.some(v => v.url === src)) {
              const videoInfo = {
                url: src,
                title: source.title || `Plyr Video`,
                width: null,
                height: null,
                duration: null,
                thumbnail: source.poster || null,
                extension: getExtension(src),
                filename: getFilename(src)
              };
              videos.push(videoInfo);
            }
          }
        } catch (e) {
          // Individual player error
        }
      });
    }
  } catch (e) {
    // Plyr not available
  }

  // Detect videos in JW Player instances
  try {
    if (window.jwplayer) {
      const players = document.querySelectorAll('[id^="jwplayer"], .jwplayer');
      players.forEach(playerEl => {
        try {
          const player = window.jwplayer(playerEl.id || playerEl);
          if (player && player.getPlaylist) {
            const playlist = player.getPlaylist();
            if (playlist && playlist.length > 0) {
              playlist.forEach((item, index) => {
                const src = item.file || item.sources?.[0]?.file;
                if (src && !videos.some(v => v.url === src)) {
                  const videoInfo = {
                    url: src,
                    title: item.title || `JW Player Video ${index + 1}`,
                    width: null,
                    height: null,
                    duration: item.duration ? formatDuration(item.duration) : null,
                    thumbnail: item.image || null,
                    extension: getExtension(src),
                    filename: getFilename(src)
                  };
                  videos.push(videoInfo);
                }
              });
            }
          }
        } catch (e) {
          // Individual player error
        }
      });
    }
  } catch (e) {
    // JW Player not available
  }

  // Detect videos in Flowplayer instances
  try {
    if (window.flowplayer) {
      document.querySelectorAll('.flowplayer').forEach(playerEl => {
        try {
          const player = window.flowplayer(playerEl);
          if (player && player.video) {
            const src = player.video.src || player.video.url;
            if (src && !videos.some(v => v.url === src)) {
              const videoInfo = {
                url: src,
                title: player.video.title || `Flowplayer Video`,
                width: null,
                height: null,
                duration: null,
                thumbnail: player.video.poster || null,
                extension: getExtension(src),
                filename: getFilename(src)
              };
              videos.push(videoInfo);
            }
          }
        } catch (e) {
          // Individual player error
        }
      });
    }
  } catch (e) {
    // Flowplayer not available
  }

  // Detect videos in Open Graph meta tags
  const ogVideo = document.querySelector('meta[property="og:video"]');
  if (ogVideo) {
    const src = ogVideo.getAttribute('content');
    if (src && !videos.some(v => v.url === src)) {
      const title = document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        document.querySelector('meta[name="title"]')?.getAttribute('content') ||
        `Video`;
      const videoInfo = {
        url: src,
        title: title,
        width: document.querySelector('meta[property="og:video:width"]')?.getAttribute('content') || null,
        height: document.querySelector('meta[property="og:video:height"]')?.getAttribute('content') || null,
        duration: null,
        thumbnail: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null,
        extension: getExtension(src),
        filename: getFilename(src)
      };
      videos.push(videoInfo);
    }
  }

  // Detect videos in Twitter Card meta tags
  const twitterPlayer = document.querySelector('meta[name="twitter:player"]');
  if (twitterPlayer) {
    const src = twitterPlayer.getAttribute('content');
    if (src && !videos.some(v => v.url === src)) {
      const title = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
        `Twitter Video`;
      const videoInfo = {
        url: src,
        title: title,
        width: document.querySelector('meta[name="twitter:player:width"]')?.getAttribute('content') || null,
        height: document.querySelector('meta[name="twitter:player:height"]')?.getAttribute('content') || null,
        duration: null,
        thumbnail: document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || null,
        extension: getExtension(src),
        filename: getFilename(src)
      };
      videos.push(videoInfo);
    }
  }

  // Detect videos in JSON-LD structured data
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      const extractVideos = (obj) => {
        if (Array.isArray(obj)) {
          obj.forEach(item => extractVideos(item));
        } else if (obj && typeof obj === 'object') {
          // Check for video content
          if (obj.contentUrl && (obj.contentUrl.includes('.mp4') || obj.contentUrl.includes('.webm') || obj.contentUrl.includes('video'))) {
            const src = obj.contentUrl;
            if (!videos.some(v => v.url === src)) {
              const videoInfo = {
                url: src,
                title: obj.name || obj.headline || `Video`,
                width: obj.width || null,
                height: obj.height || null,
                duration: obj.duration ? formatDuration(obj.duration) : null,
                thumbnail: obj.thumbnailUrl || obj.image || null,
                extension: getExtension(src),
                filename: getFilename(src)
              };
              videos.push(videoInfo);
            }
          }
          // Recursively check nested objects
          Object.values(obj).forEach(value => {
            if (typeof value === 'object') {
              extractVideos(value);
            }
          });
        }
      };
      extractVideos(data);
    } catch (e) {
      // Invalid JSON
    }
  });

  // Detect videos in CSS background images (video URLs)
  const styleSheets = Array.from(document.styleSheets);
  styleSheets.forEach(sheet => {
    try {
      const rules = Array.from(sheet.cssRules || sheet.rules || []);
      rules.forEach(rule => {
        if (rule.style) {
          const bgImage = rule.style.backgroundImage || rule.style.background;
          if (bgImage) {
            const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (urlMatch && urlMatch[1]) {
              const url = urlMatch[1];
              if ((url.includes('.mp4') || url.includes('.webm') || url.includes('.ogg') || url.includes('.mov')) &&
                !videos.some(v => v.url === url)) {
                const videoInfo = {
                  url: url,
                  title: `Background Video`,
                  width: null,
                  height: null,
                  duration: null,
                  thumbnail: null,
                  extension: getExtension(url),
                  filename: getFilename(url)
                };
                videos.push(videoInfo);
              }
            }
          }
        }
      });
    } catch (e) {
      // Cross-origin stylesheet or other error
    }
  });

  // Detect videos in script tags (look for video URLs in JavaScript)
  document.querySelectorAll('script:not([type="application/ld+json"])').forEach(script => {
    const content = script.textContent || script.innerHTML;
    // Look for common video URL patterns in JavaScript
    const videoUrlPatterns = [
      /(?:src|url|source|file|videoUrl|video_url|videoSrc)\s*[:=]\s*['"]([^'"]*\.(?:mp4|webm|ogg|mov)[^'"]*)['"]/gi,
      /(?:src|url|source|file|videoUrl|video_url|videoSrc)\s*[:=]\s*['"]([^'"]*video[^'"]*)['"]/gi
    ];

    videoUrlPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const url = match[1];
        if (url && !url.startsWith('blob:') && !url.startsWith('data:') && !videos.some(v => v.url === url)) {
          // Try to extract title from nearby code
          const context = content.substring(Math.max(0, match.index - 100), match.index + 100);
          const titleMatch = context.match(/(?:title|name|label)\s*[:=]\s*['"]([^'"]+)['"]/i);
          const title = titleMatch ? titleMatch[1] : `Video from Script`;

          const videoInfo = {
            url: url,
            title: title,
            width: null,
            height: null,
            duration: null,
            thumbnail: null,
            extension: getExtension(url),
            filename: getFilename(url)
          };
          videos.push(videoInfo);
        }
      }
    });
  });

  // Detect videos in more iframe sources (additional platforms)
  document.querySelectorAll('iframe').forEach(iframe => {
    const src = iframe.src || iframe.getAttribute('data-src') || '';

    // Additional video platforms
    const platforms = [
      { pattern: /twitch\.tv\/(?:videos\/)?(\d+)/, name: 'Twitch', watchUrl: (id) => `https://www.twitch.tv/videos/${id}` },
      { pattern: /facebook\.com\/(?:.*\/)?videos\/(\d+)/, name: 'Facebook', watchUrl: (id) => `https://www.facebook.com/watch/?v=${id}` },
      { pattern: /instagram\.com\/(?:.*\/)?p\/([^\/]+)/, name: 'Instagram', watchUrl: (id) => `https://www.instagram.com/p/${id}` },
      { pattern: /tiktok\.com\/(?:.*\/)?video\/(\d+)/, name: 'TikTok', watchUrl: (id) => `https://www.tiktok.com/@user/video/${id}` },
      { pattern: /bilibili\.com\/video\/([^\/\?]+)/, name: 'Bilibili', watchUrl: (id) => `https://www.bilibili.com/video/${id}` }
    ];

    platforms.forEach(platform => {
      const match = src.match(platform.pattern);
      if (match && match[1]) {
        const videoId = match[1];
        const watchUrl = platform.watchUrl(videoId);

        if (!videos.some(v => v.url === watchUrl)) {
          const title = iframe.getAttribute('title') ||
            iframe.getAttribute('aria-label') ||
            `${platform.name} Video ${videoId.substring(0, 8)}`;

          const videoInfo = {
            url: watchUrl,
            downloadUrl: watchUrl,
            title: title,
            width: iframe.width || iframe.getAttribute('width') || null,
            height: iframe.height || iframe.getAttribute('height') || null,
            duration: null,
            thumbnail: null,
            extension: 'mp4',
            filename: `${platform.name.toLowerCase()}_${videoId}.mp4`,
            platform: platform.name.toLowerCase(),
            videoId: videoId
          };
          videos.push(videoInfo);
        }
      }
    });
  });

  // Detect videos in canvas elements (some players use canvas)
  document.querySelectorAll('canvas').forEach(canvas => {
    try {
      // Check if canvas has video context or is playing video
      const context = canvas.getContext('2d') || canvas.getContext('webgl') || canvas.getContext('webgl2');
      // Look for video-related data attributes
      const videoSrc = canvas.getAttribute('data-video-src') ||
        canvas.getAttribute('data-src') ||
        canvas.getAttribute('data-video-url');
      if (videoSrc && !videos.some(v => v.url === videoSrc)) {
        const videoInfo = {
          url: videoSrc,
          title: canvas.getAttribute('title') || `Canvas Video`,
          width: canvas.width || null,
          height: canvas.height || null,
          duration: null,
          thumbnail: null,
          extension: getExtension(videoSrc),
          filename: getFilename(videoSrc)
        };
        videos.push(videoInfo);
      }
    } catch (e) {
      // Canvas access error
    }
  });

  // Detect videos in common video player class names and IDs
  const playerSelectors = [
    '.video-player', '.videoPlayer', '.video_player',
    '.media-player', '.mediaPlayer', '.media_player',
    '[class*="video-player"]', '[class*="VideoPlayer"]',
    '[id*="video-player"]', '[id*="VideoPlayer"]',
    '[class*="plyr"]', '[class*="jwplayer"]',
    '[class*="flowplayer"]', '[class*="videojs"]'
  ];

  playerSelectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(player => {
        // Check all possible video source attributes
        const videoAttrs = [
          'data-video-src', 'data-src', 'data-video-url', 'data-video',
          'data-file', 'data-source', 'data-url', 'data-mp4',
          'data-webm', 'data-ogg', 'src', 'href'
        ];

        videoAttrs.forEach(attr => {
          const value = player.getAttribute(attr);
          if (value && (value.includes('.mp4') || value.includes('.webm') ||
            value.includes('.ogg') || value.includes('.mov') ||
            value.match(/video/i)) &&
            !value.startsWith('blob:') && !value.startsWith('data:') &&
            !videos.some(v => v.url === value)) {
            const title = player.getAttribute('title') ||
              player.getAttribute('data-title') ||
              player.getAttribute('aria-label') ||
              player.querySelector('[class*="title"]')?.textContent?.trim() ||
              `Video Player`;

            const videoInfo = {
              url: value,
              title: title,
              width: player.getAttribute('width') || null,
              height: player.getAttribute('height') || null,
              duration: null,
              thumbnail: player.getAttribute('data-poster') ||
                player.getAttribute('poster') ||
                player.querySelector('img[class*="poster"]')?.src ||
                null,
              extension: getExtension(value),
              filename: getFilename(value)
            };
            videos.push(videoInfo);
          }
        });
      });
    } catch (e) {
      // Selector error
    }
  });

  // Detect videos in React/Vue/Angular component data (common patterns)
  document.querySelectorAll('[data-react-component], [data-vue-component], [data-ng-component]').forEach(component => {
    // Check for video URLs in component props/data
    const allAttrs = Array.from(component.attributes);
    allAttrs.forEach(attr => {
      const value = attr.value;
      if (value && (value.includes('.mp4') || value.includes('.webm') ||
        value.includes('.ogg') || value.includes('.mov')) &&
        !value.startsWith('blob:') && !value.startsWith('data:') &&
        !videos.some(v => v.url === value)) {
        const videoInfo = {
          url: value,
          title: component.getAttribute('data-title') ||
            component.getAttribute('title') ||
            `Component Video`,
          width: null,
          height: null,
          duration: null,
          thumbnail: null,
          extension: getExtension(value),
          filename: getFilename(value)
        };
        videos.push(videoInfo);
      }
    });
  });

  // Detect videos in Web Components (custom elements)
  document.querySelectorAll('*').forEach(element => {
    if (element.tagName.includes('-')) { // Custom elements have hyphens
      const videoAttrs = ['video-src', 'video-url', 'src', 'data-src', 'data-video-src'];
      videoAttrs.forEach(attr => {
        const value = element.getAttribute(attr);
        if (value && (value.includes('.mp4') || value.includes('.webm') ||
          value.includes('.ogg') || value.includes('.mov')) &&
          !value.startsWith('blob:') && !value.startsWith('data:') &&
          !videos.some(v => v.url === value)) {
          const videoInfo = {
            url: value,
            title: element.getAttribute('title') ||
              element.getAttribute('data-title') ||
              element.tagName.toLowerCase(),
            width: element.getAttribute('width') || null,
            height: element.getAttribute('height') || null,
            duration: null,
            thumbnail: element.getAttribute('poster') || null,
            extension: getExtension(value),
            filename: getFilename(value)
          };
          videos.push(videoInfo);
        }
      });
    }
  });

  // --- Network Hunter Integration ---
  // Add all URLs found by the Network Hunter that weren't captured by other specific scanners
  networkUrls.forEach(url => {
    if (!videos.some(v => v.url === url)) {
      const extension = getExtension(url);
      const filename = getFilename(url);

      // Try to find a nice title from the URL
      let title = filename.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/gi, ' ').trim();
      if (!title || title.length < 3) title = `Direct Download (${extension.toUpperCase()})`;

      videos.push({
        url: url,
        title: title,
        width: null,
        height: null,
        duration: null,
        thumbnail: null,
        extension: extension,
        filename: filename,
        isHunted: true // Flag to show it was found via network hunting
      });
    }
  });

  // Remove duplicates (but keep all blob URLs as they're unique)
  const uniqueVideos = [];
  const seenUrls = new Set();
  videos.forEach(video => {
    // For blob URLs, use a combination of URL and index to ensure uniqueness
    // For platform videos (YouTube, etc.), use platform + videoId as key
    let key;
    if (video.isBlob) {
      key = `${video.url}_${videos.indexOf(video)}`;
    } else if (video.platform && video.videoId) {
      key = `${video.platform}_${video.videoId}`;
    } else {
      key = video.url;
    }

    if (!seenUrls.has(key)) {
      seenUrls.add(key);
      uniqueVideos.push(video);
    }
  });

  // Debug: log how many videos found
  console.log(`[Video Downloader] Total videos found: ${videos.length}, Unique: ${uniqueVideos.length} (${uniqueVideos.filter(v => v.isBlob).length} blob URLs)`);
  if (videos.length > 0 && uniqueVideos.length === 0) {
    console.warn('[Video Downloader] WARNING: Videos found but all filtered out during deduplication!');
    console.log('Sample videos:', videos.slice(0, 3).map(v => ({ url: v.url?.substring(0, 50), isBlob: v.isBlob, title: v.title })));
  }
  if (uniqueVideos.length > 0) {
    console.log(`[Video Downloader] Videos to return:`, uniqueVideos.slice(0, 3).map(v => ({ url: v.url?.substring(0, 50), title: v.title })));
  }

  // Fetch size for each video (skip for file:// URLs due to CORS)
  try {
    const isFileProtocol = window.location.protocol === 'file:';

    // Ensure all videos have a size property before processing
    uniqueVideos.forEach(video => {
      if (!video.size) {
        video.size = 'Unknown';
      }
    });

    return Promise.all(uniqueVideos.map(async (video) => {
      // Skip size fetching for:
      // - file:// URLs (CORS)
      // - blob URLs (temporary)
      // - Platform videos (YouTube, Vimeo, etc. - not direct video files)
      if (isFileProtocol ||
        video.url.startsWith('blob:') ||
        video.url.startsWith('file:') ||
        video.platform) {
        // Size already set to 'Unknown' above
        return video;
      }

      try {
        const response = await fetch(video.url, { method: 'HEAD' });
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          video.size = formatBytes(parseInt(contentLength));
        } else {
          video.size = 'Unknown';
        }
      } catch (err) {
        // CORS error or other fetch error - set size to Unknown
        video.size = 'Unknown';
      }
      return video;
    }));
  } catch (err) {
    // If anything fails, return the videos we found (without sizes)
    console.error('[Video Downloader] Error in size fetching:', err);
    return Promise.resolve(uniqueVideos);
  }
}

// Debug function to analyze page and identify why videos aren't detected
function debugPageAnalysis() {
  const debugData = {
    url: window.location.href,
    videoElements: [],
    iframes: [],
    sourceElements: [],
    dataUrls: [],
    customElements: [],
    pageType: 'unknown',
    youtubeVideoId: null,
    totalPotentialVideos: 0,
    detectableVideos: 0
  };

  // Check if YouTube watch page
  if (window.location.href.includes('youtube.com/watch') || window.location.href.includes('youtu.be/')) {
    debugData.pageType = 'youtube';
    const match = window.location.href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^"&?\/\s]{11})/);
    if (match && match[1]) {
      debugData.youtubeVideoId = match[1];
      debugData.detectableVideos = 1;
    }
  }

  // Find all <video> elements
  document.querySelectorAll('video').forEach(video => {
    const sources = [];
    if (video.src) sources.push(video.src);
    video.querySelectorAll('source').forEach(source => {
      if (source.src) sources.push(source.src);
    });
    debugData.videoElements.push({
      src: video.src || null,
      sources: sources,
      poster: video.poster || null,
      width: video.videoWidth || video.getAttribute('width'),
      height: video.videoHeight || video.getAttribute('height')
    });
    if (sources.length > 0) debugData.detectableVideos++;
  });

  // Find all <iframe> elements
  document.querySelectorAll('iframe').forEach(iframe => {
    const src = iframe.src || iframe.getAttribute('data-src') || '';
    debugData.iframes.push({
      src: src,
      title: iframe.getAttribute('title') || null
    });
    if (src.includes('youtube') || src.includes('vimeo') || src.includes('dailymotion')) {
      debugData.detectableVideos++;
    }
  });

  // Find all <source> elements
  document.querySelectorAll('source[type*="video"]').forEach(source => {
    debugData.sourceElements.push({
      src: source.src || null,
      type: source.type || null
    });
    if (source.src && !source.src.startsWith('blob:') && !source.src.startsWith('data:')) {
      debugData.detectableVideos++;
    }
  });

  // Find video URLs in data attributes
  const dataAttributes = ['data-video-url', 'data-src', 'data-video-src', 'data-video', 'data-file', 'data-source', 'data-url', 'data-mp4', 'data-webm'];
  document.querySelectorAll('*').forEach(el => {
    dataAttributes.forEach(attr => {
      const value = el.getAttribute(attr);
      if (value && (value.includes('.mp4') || value.includes('.webm') || value.includes('.ogg') || value.includes('.mov'))) {
        if (!debugData.dataUrls.includes(value)) {
          debugData.dataUrls.push(value);
          debugData.detectableVideos++;
        }
      }
    });
  });

  // Find custom elements (Web Components)
  document.querySelectorAll('*').forEach(el => {
    if (el.tagName.includes('-')) { // Custom elements have hyphens
      const hasVideoAttrs = ['video-src', 'video-url', 'src', 'data-src', 'data-video-src'].some(attr => {
        const value = el.getAttribute(attr);
        return value && (value.includes('.mp4') || value.includes('.webm') || value.includes('.ogg'));
      });
      if (hasVideoAttrs) {
        debugData.customElements.push({
          tagName: el.tagName,
          attributes: Array.from(el.attributes).map(attr => ({
            name: attr.name,
            value: attr.value.substring(0, 200) // Limit length
          }))
        });
        debugData.detectableVideos++;
      }
    }
  });

  // Check for video.js, JW Player, Flowplayer, etc.
  const videoPlayers = [];
  if (window.videojs) videoPlayers.push('Video.js');
  if (window.jwplayer) videoPlayers.push('JW Player');
  if (window.Flowplayer) videoPlayers.push('Flowplayer');
  if (window.Player) videoPlayers.push('Generic Player');

  if (videoPlayers.length > 0) {
    debugData.videoPlayers = videoPlayers;
  }

  // Look for common video player containers
  const playerSelectors = [
    '.video-player', '.video-container', '.player', '.media-player',
    '[class*="video"]', '[class*="player"]', '[id*="video"]', '[id*="player"]'
  ];

  const playerContainers = [];
  playerSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        playerContainers.push({
          selector: selector,
          count: elements.length
        });
      }
    } catch (e) {
      // Invalid selector, skip
    }
  });

  if (playerContainers.length > 0) {
    debugData.playerContainers = playerContainers;
  }

  debugData.totalPotentialVideos = debugData.videoElements.length +
    debugData.iframes.length +
    debugData.sourceElements.length +
    debugData.dataUrls.length +
    (debugData.youtubeVideoId ? 1 : 0);

  return debugData;
}


