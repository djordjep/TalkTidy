import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase-init.js';

console.log('popup.js script loaded'); // Debugging log

document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const getTranscriptBtn = document.getElementById('getTranscript');
  const copyTranscriptBtn = document.getElementById('copyTranscript');
  const getSummaryBtn = document.getElementById('getSummary');
  const statusDiv = document.getElementById('status');
  const transcriptionDiv = document.getElementById('transcription');
  const signInButton = document.getElementById('signInButton');
  const signInSection = document.getElementById('signInSection');

  // Verify all required elements exist
  if (!getTranscriptBtn || !copyTranscriptBtn || !getSummaryBtn || 
      !statusDiv || !transcriptionDiv || !signInButton || !signInSection) {
    console.error('Required DOM elements not found. Check popup.html for missing elements.');
    return;
  }

  // Initially hide summary and copy buttons
  getSummaryBtn.style.display = 'none';
  copyTranscriptBtn.style.display = 'none';

  function showStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    statusDiv.className = isError ? 'error' : 'success';
  }

  console.log('popup.html DOM fully loaded and parsed'); // Debugging log

  // Update UI based on auth state
  function updateUIBasedOnAuth() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('User is signed in:', user.email); // Debugging log
        // Check if the user has a premium subscription
        checkUserAuthorization(user.uid)
          .then(isAuthorized => {
            if (isAuthorized) {
              getSummaryBtn.style.display = 'block';
              getSummaryBtn.disabled = !transcriptionDiv.textContent;
              document.getElementById('signInSection').style.display = 'none';
            } else {
              getSummaryBtn.style.display = 'none';
              document.getElementById('signInSection').style.display = 'block';
            }
          })
          .catch(error => {
            console.error('Authorization check failed:', error);
            showStatus('Authorization check failed. Please try again.', true);
          });
      } else {
        console.log('User is signed out'); // Debugging log
        getSummaryBtn.style.display = 'none';
        document.getElementById('signInSection').style.display = 'block';
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
            width: 400,
            height: 600
          });
        }
      }
    } catch (error) {
      userInfoDiv.textContent = `Error: ${error.message}`;
      console.error('Auth error:', error);
    }
  });

  // Handle summary request
  async function handleSummaryRequest() {
    try {
      const user = auth.currentUser;
      if (!user) {
        // Show sign-in section if not authenticated
        document.getElementById('signInSection').style.display = 'block';
        showStatus('Please sign in to access the summary feature.', true);
        return;
      }

      // Check if the user has a premium subscription
      const isAuthorized = await checkUserAuthorization(user.uid);
      if (!isAuthorized) {
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

// Update the checkUserAuthorization function with more logging
async function checkUserAuthorization(userId) {
  try {
    // Log the user ID being checked
    console.log('Checking authorization for user:', userId);
    
    // Get and log the ID token
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

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      // Try to get error details from response
      try {
        const errorData = await response.json();
        console.error('Error response data:', errorData);
        throw new Error(`Authorization check failed: ${JSON.stringify(errorData)}`);
      } catch (parseError) {
        console.error('Could not parse error response:', parseError);
        throw new Error(`Authorization check failed with status: ${response.status}`);
      }
    }

    const data = await response.json();
    console.log('Authorization check result:', data);
    return data.isAuthorized;
  } catch (error) {
    console.error('Error checking authorization:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}
