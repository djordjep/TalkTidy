import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase-init.js';

console.log('popup.js script loaded'); // Debugging log

document.addEventListener('DOMContentLoaded', async function() {
  // Get DOM elements with null checks
  const elements = {
    getTranscriptBtn: document.getElementById('getTranscript'),
    copyTranscriptBtn: document.getElementById('copyTranscript'),
    getSummaryBtn: document.getElementById('getSummary'),
    statusDiv: document.getElementById('status'),
    transcriptionDiv: document.getElementById('transcription'),
    signInButton: document.getElementById('signInButton'),
    signInSection: document.getElementById('signInSection'),
    mainContainer: document.getElementById('mainContainer'),
    nonYoutubeMessage: document.getElementById('nonYoutubeMessage')
  };

  // Verify all required elements exist
  const missingElements = Object.entries(elements)
    .filter(([key, element]) => !element)
    .map(([key]) => key);

  if (missingElements.length > 0) {
    console.error('Missing required elements:', missingElements);
    return;
  }

  // Now you can safely use the elements
  const {
    getTranscriptBtn,
    copyTranscriptBtn,
    getSummaryBtn,
    statusDiv,
    transcriptionDiv,
    signInButton,
    signInSection,
    mainContainer,
    nonYoutubeMessage
  } = elements;

  // Check if current tab is YouTube
  const currentTab = await getCurrentTab();
  const isYouTube = currentTab?.url?.includes('youtube.com/watch');

  if (!isYouTube) {
    // Hide main container and show message for non-YouTube sites
    mainContainer.style.display = 'none';
    nonYoutubeMessage.style.display = 'block';
    return;
  }

  // Initially hide summary and copy buttons
  getSummaryBtn.style.display = 'none';
  copyTranscriptBtn.style.display = 'none';

  function showStatus(message, isError = false) {
    if (!statusDiv) {
      console.error('Status div not found');
      return;
    }
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    statusDiv.className = isError ? 'error' : 'success';
  }

  console.log('popup.html DOM fully loaded and parsed'); // Debugging log

  // Update UI based on auth state
  function updateUIBasedOnAuth() {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('User is signed in:', user.email);
        
        document.getElementById('signInSection').style.display = 'none';
        document.getElementById('signOutButton').style.display = 'block';
        
        try {
          const isAuthorized = await checkUserAuthorization(user.uid);
          if (isAuthorized) {
            getSummaryBtn.style.display = 'block';
            getSummaryBtn.disabled = !transcriptionDiv.textContent;
          } else {
            getSummaryBtn.style.display = 'none';
            // Only open paywall if user has no credits
            if (!window.paywallWindowOpen) {
              window.paywallWindowOpen = true;
              chrome.windows.create({
                url: chrome.runtime.getURL('paywall.html'),
                type: 'popup',
                width: 460,
                height: 600
              }, (window) => {
                const checkWindow = setInterval(() => {
                  chrome.windows.get(window.id, () => {
                    if (chrome.runtime.lastError) {
                      clearInterval(checkWindow);
                      window.paywallWindowOpen = false;
                    }
                  });
                }, 1000);
              });
            }
          }
        } catch (error) {
          console.error('Authorization check failed:', error);
          showStatus('Authorization check failed. Please try again.', true);
        }
      } else {
        console.log('User is signed out');
        
        document.getElementById('signInSection').style.display = 'block';
        
        document.getElementById('signOutButton').style.display = 'none';
        
        getSummaryBtn.style.display = 'none';
      }
    });
  }

  // Handle sign-in button click
  document.getElementById('signInButton').addEventListener('click', async () => {
    console.log('Sign in button in popup clicked'); // Debugging log
    const userInfoDiv = document.getElementById('userInfo');
    
    try {
      // Perform Google sign-in
      await handleGoogleAuth();
      console.log('User signed in successfully');

      // After successful sign-in, check authorization and proceed
      const user = auth.currentUser;
      if (user) {
        const isAuthorized = await checkUserAuthorization(user.uid);
        if (isAuthorized) {
          showStatus('Authorization successful! You can now get summaries.');
          getSummaryBtn.style.display = 'block';
          getSummaryBtn.disabled = !transcriptionDiv.textContent;
          document.getElementById('signInSection').style.display = 'none';
        } else {
          showStatus('You need a premium subscription to use this feature.', true);
          chrome.windows.create({
            url: chrome.runtime.getURL('paywall.html'),
            type: 'popup',
            width: 420,
            height: 600
          });
        }
      }
    } catch (error) {
      userInfoDiv.textContent = `Error: ${error.message}`;
      console.error('Auth error:', error);
    }
  });

  // Add this helper function near the getCurrentTab function
  function getYouTubeVideoId(url) {
    const urlObj = new URL(url);
    const searchParams = new URLSearchParams(urlObj.search);
    return searchParams.get('v');
  }

  // Update the handleSummaryRequest function
  async function handleSummaryRequest() {
    if (!getSummaryBtn || !transcriptionDiv) {
      console.error('Required elements not found');
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        const signInSection = document.getElementById('signInSection');
        if (signInSection) {
          signInSection.style.display = 'block';
        }
        showStatus('Please sign in to access the summary feature.', true);
        return;
      }

      // Get current tab and video ID
      const currentTab = await getCurrentTab();
      const videoId = getYouTubeVideoId(currentTab.url);
      
      if (!videoId) {
        throw new Error('Could not find YouTube video ID');
      }

      // Add loading state to button
      getSummaryBtn.innerHTML = '<span class="spinner"></span> Processing...';
      
      // Rest of the existing validation code...
      const transcriptLength = transcriptionDiv.textContent?.length || 0;
      if (transcriptLength > 400000) { // ~100k words
        showStatus('Transcript too long. Please try a shorter video.', true);
        return;
      }

      const isAuthorized = await checkUserAuthorization(user.uid);
      if (!isAuthorized) {
        if (!window.paywallWindowOpen) {
          window.paywallWindowOpen = true;
          chrome.windows.create({
            url: chrome.runtime.getURL('paywall.html'),
            type: 'popup',
            width: 420,
            height: 600
          }, (window) => {
            const checkWindow = setInterval(() => {
              chrome.windows.get(window.id, () => {
                if (chrome.runtime.lastError) {
                  clearInterval(checkWindow);
                  window.paywallWindowOpen = false;
                }
              });
            }, 1000);
          });
        }
        return;
      }

      // Get Firebase ID token
      const idToken = await user.getIdToken();
      
      showStatus('Processing transcript...');
      getSummaryBtn.disabled = true;

      const functionUrl = process.env.FIREBASE_FUNCTION_URL + '/processTranscript';
      console.log('Calling Firebase function at:', functionUrl);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transcript: transcriptionDiv.textContent,
          videoId: videoId  // Include videoId in the request
        })
      });

      if (!response.ok) {
        let errorMessage;
        const responseText = await response.text();
        
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.code === 'CLAUDE_CREDITS_EXHAUSTED') {
            errorMessage = 'Service is temporarily unavailable. Please try again in a few minutes.';
          } else {
            errorMessage = errorData.error || 'Failed to process transcript';
          }
        } catch (e) {
          console.error('Non-JSON error response:', responseText);
          errorMessage = `Server error (${response.status}). Please try again later.`;
        }
        
        if (response.status === 403) {
          // Subscription required
          chrome.windows.create({
            url: chrome.runtime.getURL('paywall.html'),
            type: 'popup',
            width: 420,
            height: 600
          });
          return;
        }
        throw new Error(errorMessage);
      }

      try {
        const data = await response.json();
        console.log('Received data from server:', data);
        
        // Verify transcriptionDiv exists
        if (!transcriptionDiv) {
          throw new Error('Transcript display element not found');
        }

        // Check if we have the expected data structure
        if (!data.response) {
          throw new Error('Invalid response format from server');
        }

        // Add summary metadata with provider information
        const providerName = data.provider === 'claude' ? 'Claude AI' : 'GPT-4';
        transcriptionDiv.textContent = 
          `Summary generated by ${providerName} on ${new Date().toLocaleString()}:\n\n${data.response}`;
        
        // Safely update credits display if element exists
        const creditsDisplay = document.getElementById('creditsDisplay');
        if (creditsDisplay && data.creditsRemaining !== undefined) {
          creditsDisplay.textContent = `Credits remaining: ${data.creditsRemaining}`;
        }

        showStatus('Summary generated successfully!');
      } catch (error) {
        console.error('Error handling response:', error);
        showStatus(`Error: ${error.message}. Please try again.`, true);
        throw error;
      } finally {
        getSummaryBtn.disabled = false;
        getSummaryBtn.innerHTML = 'Get Summary';
      }
    } catch (error) {
      console.error('Summary request error:', error);
      showStatus(`Error: ${error.message || 'Failed to process summary'}. Please try again.`, true);
    }
  }

  // Add getCurrentTab function
  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  // Event listeners
  getTranscriptBtn.addEventListener('click', async () => {
    try {
      console.log('Button clicked');
      const tab = await getCurrentTab();
      console.log('Current tab:', tab);

      // Check if we're on a YouTube video page
      if (!tab.url?.includes('youtube.com/watch')) {
        showStatus('Please navigate to a YouTube video page', true);
        return;
      }

      showStatus('Fetching transcript...');
      getTranscriptBtn.disabled = true;

      // First, inject the content script if not already injected
      try {
        console.log('Injecting content script...');
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('Content script injected successfully');
      } catch (error) {
        console.log('Content script injection error:', error);
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }

      // Wait a moment for the content script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('Sending getTranscript message...');
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: "getTranscript",
        timestamp: Date.now() // Add timestamp to ensure message uniqueness
      });
      
      console.log('Received response:', response);
      
      if (response?.success) {
        transcriptionDiv.textContent = response.transcript;
        transcriptionDiv.style.display = 'block';
        copyTranscriptBtn.style.display = 'block';
        getSummaryBtn.style.display = 'block';
        showStatus('Transcript fetched successfully!');
      } else {
        throw new Error(response?.error || 'Failed to fetch transcript');
      }
    } catch (error) {
      console.error('Transcript extraction error:', error);
      showStatus(`Error: ${error.message}. Please refresh and try again.`, true);
    } finally {
      getTranscriptBtn.disabled = false;
      getSummaryBtn.disabled = !transcriptionDiv.textContent;
    }
  });

  copyTranscriptBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(transcriptionDiv.textContent);
      showStatus('Transcript copied to clipboard!');
    } catch (err) {
      showStatus('Failed to copy to clipboard', true);
    }
  });

  getSummaryBtn.addEventListener('click', handleSummaryRequest);

  // Add event listener for Sign Out button
  document.getElementById('signOutButton').addEventListener('click', async () => {
    try {
      await auth.signOut();
      console.log('User signed out successfully');
      
      // Send message to background script to remove cached token
      await chrome.runtime.sendMessage({ type: 'REMOVE_CACHED_TOKEN' });
      
      updateUIBasedOnAuth();
    } catch (error) {
      console.error('Sign Out Error:', error);
      alert('Sign out failed. Please try again.');
    }
  });

  // Initialize UI
  updateUIBasedOnAuth();

  // Ensure the sign-in section is hidden initially
  document.getElementById('signInSection').style.display = 'none';
});

// Example of how to make Google API calls from popup
async function handleGoogleAuth() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GOOGLE_API_REQUEST',
      action: 'AUTH'
    });
    
    if (!response.success) {
      throw new Error(response.error);
    }
    
    return response.data;
  } catch (error) {
    console.error('Failed to authenticate:', error);
    throw error;
  }
}

// Update the checkUserAuthorization function to handle the response
async function checkUserAuthorization(userId) {
  try {
    const idToken = await auth.currentUser.getIdToken();
    console.log('Got ID token:', idToken.substring(0, 10) + '...');
    
    const url = `${process.env.FIREBASE_FUNCTION_URL}/checkAuthorization`;
    console.log('Making request to:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ uid: userId })
    });

    if (!response.ok) {
      throw new Error(`Authorization check failed with status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Authorization check result:', data);
    
    // Store the credits count in local state if needed
    if (data.credits !== undefined) {
      // You might want to display this somewhere in the UI
      console.log(`User has ${data.credits} credits remaining`);
    }

    return data.isAuthorized;
  } catch (error) {
    console.error('Error checking authorization:', error);
    throw error;
  }
}

// Update the openPaywall function to properly encode the token
async function openPaywall() {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get a fresh ID token
    const idToken = await user.getIdToken(true);
    
    // Properly encode the token for URL
    const encodedToken = encodeURIComponent(idToken);
    
    if (!window.paywallWindowOpen) {
      window.paywallWindowOpen = true;
      const paywallUrl = chrome.runtime.getURL('paywall.html') + 
        `?token=${encodedToken}&timestamp=${Date.now()}`; // Add timestamp to prevent caching
      
      console.log('Opening paywall with encoded token');
      
      chrome.windows.create({
        url: paywallUrl,
        type: 'popup',
        width: 460,
        height: 640
      }, (window) => {
        const checkWindow = setInterval(() => {
          chrome.windows.get(window.id, () => {
            if (chrome.runtime.lastError) {
              clearInterval(checkWindow);
              window.paywallWindowOpen = false;
            }
          });
        }, 1000);
      });
    }
  } catch (error) {
    console.error('Error opening paywall:', error);
    showStatus('Failed to open payment window. Please try again.', true);
  }
}
