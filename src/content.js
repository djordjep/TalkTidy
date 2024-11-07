console.log('Content script loaded!');

// Single message listener for all actions
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Message received in content script:', request);
  
  if (request.test === 'hello') {
    console.log('Received test message');
    sendResponse({ received: true });
    return false; // No need to keep channel open for sync response
  }
  
  if (request.action === "getTranscript") {
    console.log('Starting transcript extraction process...');
    getYouTubeTranscript()
      .then(result => {
        console.log('Transcript extraction successful:', result);
        sendResponse({ success: true, transcript: result.transcript });
      })
      .catch(error => {
        console.error('Transcript extraction error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
});

async function getYouTubeTranscript() {
  console.log('Starting transcript extraction...');

  try {
    // Get video title
    const titleElement = document.querySelector('h1.style-scope.ytd-watch-metadata yt-formatted-string');
    const videoTitle = titleElement ? titleElement.textContent.trim() : 'Untitled Video';
    
    // Get video URL
    const videoUrl = window.location.href;
    
    // Scroll to the description area
    const descriptionArea = document.querySelector('#description');
    if (descriptionArea) {
      descriptionArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log('Looking for more button...');
    const moreButton = document.querySelector('#expand') || 
                      document.querySelector('tp-yt-paper-button#expand') ||
                      Array.from(document.querySelectorAll('tp-yt-paper-button')).find(btn => 
                        btn.textContent.toLowerCase().includes('more'));

    if (moreButton) {
      console.log('Found more button, clicking...');
      moreButton.click();
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log('Looking for transcript button...');
    let transcriptButton = null;
    
    // Try multiple strategies to find the transcript button
    transcriptButton = document.querySelector('button.yt-spec-button-shape-next--outline');
    
    if (!transcriptButton) {
      const buttons = Array.from(document.querySelectorAll('button'));
      transcriptButton = buttons.find(btn => {
        const text = btn.textContent.toLowerCase();
        return text.includes('show transcript') || text.includes('show transcription');
      });
    }
    
    if (!transcriptButton) {
      const spans = Array.from(document.querySelectorAll('span[role="text"]'));
      const transcriptSpan = spans.find(span => 
        span.textContent.toLowerCase().includes('transcript')
      );
      if (transcriptSpan) {
        transcriptButton = transcriptSpan.closest('button');
      }
    }

    if (!transcriptButton) {
      throw new Error('Could not find transcript button. Please make sure transcripts are available for this video.');
    }

    console.log('Found transcript button, clicking...');
    transcriptButton.click();
    await new Promise(r => setTimeout(r, 3000));

    console.log('Looking for transcript container...');
    const transcriptContainer = await waitForElement('ytd-transcript-renderer', 10000);
    
    if (!transcriptContainer) {
      throw new Error('Transcript container not found after clicking button');
    }

    console.log('Found transcript container, extracting segments...');
    const segments = transcriptContainer.querySelectorAll('ytd-transcript-segment-renderer');
    
    if (!segments.length) {
      throw new Error('No transcript segments found in container');
    }

    console.log(`Found ${segments.length} transcript segments`);
    const transcriptText = Array.from(segments)
      .map(segment => {
        const timestamp = segment.querySelector('.segment-timestamp')?.textContent.trim() || '';
        const text = segment.querySelector('.segment-text')?.textContent.trim() || '';
        return text ? `[${timestamp}] ${text}` : null;
      })
      .filter(Boolean)
      .join('\n');

    if (!transcriptText) {
      throw new Error('Failed to extract transcript text from segments');
    }

    // Format the complete output with title and URL
    const formattedOutput = `Title: ${videoTitle}
URL: ${videoUrl}

Transcript:
${transcriptText}`;

    console.log('Successfully extracted transcript text');
    return {
      title: videoTitle,
      url: videoUrl,
      transcript: formattedOutput
    };

  } catch (error) {
    console.error('Error in transcript extraction:', error);
    throw error;
  }
}

function waitForElement(selector, timeout = 5000) {
  console.log(`Waiting for element: ${selector}`);
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`Element ${selector} found immediately`);
      return resolve(element);
    }

    let timeoutId;
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`Element ${selector} found after waiting`);
        clearTimeout(timeoutId);
        obs.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    timeoutId = setTimeout(() => {
      observer.disconnect();
      console.log(`Timeout waiting for element: ${selector}`);
      reject(new Error(`Timeout waiting for ${selector}`));
    }, timeout);
  });
}

// Example of sending transcript to background script
async function sendTranscriptForProcessing(transcript) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'processTranscript',
      transcript: transcript
    });
    
    if (!response.success) {
      throw new Error(response.error);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error processing transcript:', error);
    throw error;
  }
}