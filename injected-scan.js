// This file contains the video scanning functions that will be injected into pages
// It's kept separate to ensure all dependencies are available when injected

// Main scanning function - injected into page context
async function scanForVideosWithRetry() {
  // Import scanForVideos by defining it here
  const scanForVideos = function() {
    // This will be replaced by the actual scanForVideos function
    // For now, return empty array as fallback
    return Promise.resolve([]);
  };
  
  try {
    console.log('[Video Downloader] scanForVideosWithRetry started on:', window.location.href);
    
    const isFileProtocol = window.location.protocol === 'file:';
    await new Promise(resolve => setTimeout(resolve, isFileProtocol ? 100 : 500));
    
    console.log('[Video Downloader] Starting first scan...');
    let videos = await scanForVideos();
    console.log('[Video Downloader] First scan completed, found:', videos?.length || 0, 'videos');
    
    if (!Array.isArray(videos)) {
      console.error('[Video Downloader] scanForVideos did not return an array:', videos);
      videos = [];
    }
    
    if (videos.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const newVideos = await scanForVideos();
      if (Array.isArray(newVideos)) {
        videos = newVideos;
      }
    }
    
    if (videos.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const newVideos = await scanForVideos();
      if (Array.isArray(newVideos)) {
        videos = newVideos;
      }
    }
    
    return new Promise((resolve) => {
      let resolved = false;
      
      const observer = new MutationObserver(async () => {
        if (resolved) return;
        try {
          const newVideos = await scanForVideos();
          if (Array.isArray(newVideos) && newVideos.length > videos.length) {
            videos = newVideos;
            resolved = true;
            observer.disconnect();
            resolve(videos);
          }
        } catch (err) {
          if (!resolved) {
            resolved = true;
            observer.disconnect();
            resolve(videos);
          }
        }
      });
      
      if (document.body || document.documentElement) {
        observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['src', 'poster', 'data-src', 'data-video-src', 'data-video-url']
        });
      }
      
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          observer.disconnect();
          resolve(Array.isArray(videos) ? videos : []);
        }
      }, 3000);
      
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
    console.error('[Video Downloader] Error in scanForVideosWithRetry:', err);
    return [];
  }
}

