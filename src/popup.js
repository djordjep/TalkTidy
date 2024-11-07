import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase-init.js';

document.addEventListener('DOMContentLoaded', function() {
  const getTranscriptBtn = document.getElementById('getTranscript');
  const copyTranscriptBtn = document.getElementById('copyTranscript');
  const getSummaryBtn = document.getElementById('getSummary');
  const statusDiv = document.getElementById('status');
  const transcriptionDiv = document.getElementById('transcription');

  // Initially hide summary and copy buttons
  getSummaryBtn.style.display = 'none';
  copyTranscriptBtn.style.display = 'none';

  function showStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    statusDiv.className = isError ? 'error' : 'success';
  }

  // Update UI based on auth state
  function updateUIBasedOnAuth() {
    onAuthStateChanged(auth, (user) => {
      // Always show the summary button, but disable it if no transcript
      getSummaryBtn.style.display = 'block';
      getSummaryBtn.disabled = !transcriptionDiv.textContent;
    });
  }

  // Handle summary request
  async function handleSummaryRequest() {
    try {
      const user = auth.currentUser;
      if (!user) {
        // Show paywall for unauthorized users
        chrome.windows.create({
          url: chrome.runtime.getURL('paywall.html'),
          type: 'popup',
          width: 400,
          height: 600
        });
        return;
      }

      // Get Firebase ID token
      const idToken = await user.getIdToken();
      
      showStatus('Processing transcript...');
      getSummaryBtn.disabled = true;

      const response = await fetch(process.env.FIREBASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transcript: transcriptionDiv.textContent
        })
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 403) {
          // Subscription required
          chrome.windows.create({
            url: chrome.runtime.getURL('paywall.html'),
            type: 'popup',
            width: 400,
            height: 600
          });
          return;
        }
        throw new Error(error.error || 'Failed to process transcript');
      }

      const data = await response.json();
      transcriptionDiv.textContent = data.response;
      showStatus('Summary generated successfully!');

    } catch (error) {
      showStatus(`Error: ${error.message}`, true);
    } finally {
      getSummaryBtn.disabled = false;
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
          files: ['dist/content.js']
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

  // Initialize UI
  updateUIBasedOnAuth();
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