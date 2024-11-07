// Service worker-specific setup
// self.importScripts('dist/firebase-app.js', 'dist/firebase-auth.js');

// Instead, import Firebase modules directly
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Add activation listener
self.addEventListener('activate', event => {
  console.log('Service worker activated');
  // Add onInstalled listener
  chrome.runtime.onInstalled.addListener(() => {
  // Only inject into YouTube tabs
  chrome.tabs.query({ 
    url: ["*://*.youtube.com/*"]
  }, (tabs) => {
    if (tabs.length > 0) {
      tabs.forEach(tab => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['dist/permissions.js']
        }).catch(err => console.error('Script injection error:', err));
      });
    }
    });
  });
});

// Add install listener
self.addEventListener('install', event => {
  console.log('Service worker installed');
  self.skipWaiting(); // Optionally skip waiting to activate
});

// Listen for messages
self.addEventListener('message', event => {
  console.log('Message received in service worker:', event.data);
});

// Get Firebase ID token
async function getIdToken() {
  try {
    // Get Chrome identity token
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });

    // Create credential from token
    const credential = GoogleAuthProvider.credential(null, token);
    
    // Sign in to Firebase
    const userCredential = await signInWithCredential(auth, credential);
    
    // Get Firebase ID token
    return await userCredential.user.getIdToken();
  } catch (error) {
    console.error('Error getting Firebase ID token:', error);
    throw error;
  }
}

// Listen for auth state changes
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('User is signed in:', user.email);
  } else {
    console.log('User is signed out');
  }
});

// Make API call to Firebase Function
async function callFirebaseFunction(transcript) {
  try {
    const idToken = await getIdToken();
    const response = await fetch('YOUR_FIREBASE_FUNCTION_URL', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling Firebase function:', error);
    throw error;
  }
}

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processTranscript') {
    callFirebaseFunction(request.transcript)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

// Handle Google API calls
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GOOGLE_API_REQUEST') {
    // Handle different types of Google API requests
    switch (request.action) {
      case 'AUTH':
        handleGoogleAuth()
          .then(response => sendResponse({ success: true, data: response }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        break;
      // Add other API call handlers as needed
    }
    return true; // Keep message channel open for async response
  }
});

async function handleGoogleAuth() {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result;
  } catch (error) {
    console.error('Auth Error:', error);
    throw error;
  }
}