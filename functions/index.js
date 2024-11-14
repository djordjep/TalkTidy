const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin with explicit project configuration
admin.initializeApp({
  projectId: 'talktidy-ab88f',
  // If using credentials file, uncomment and update path:
  // credential: admin.credential.cert(require('./service-account-key.json'))
});

// Initialize Firestore
const db = admin.firestore();

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

exports.processTranscript = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    // Check if request method is POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Only POST requests are allowed' });
    }

    try {
      // Verify Firebase Auth token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authentication token provided' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      // Check if user has paid subscription
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists || !userDoc.data().isPaid) {
        return res.status(403).json({ error: 'Subscription required' });
      }

      // Get transcript from request body
      const { transcript } = req.body;
      if (!transcript) {
        return res.status(400).json({ error: 'No transcript provided' });
      }

      // Process transcript with Claude AI
      const message = await anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: transcript
        }]
      });

      // Return Claude's response
      return res.status(200).json({
        success: true,
        response: message.content[0].text
      });

    } catch (error) {
      console.error('Error processing request:', error);
      
      if (error.code === 'auth/invalid-id-token') {
        return res.status(401).json({ error: 'Invalid authentication token' });
      }
      
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// Export the auth function that was already present
exports.createCustomToken = require('./auth').createCustomToken;

// Update the checkAuthorization function with more logging
exports.checkAuthorization = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    console.log('Received authorization check request');
    
    if (req.method !== 'POST') {
      console.log('Invalid method:', req.method);
      return res.status(405).json({ error: 'Only POST requests are allowed' });
    }

    try {
      // Log headers for debugging
      console.log('Request headers:', req.headers);
      
      // Verify Firebase Auth token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('Missing or invalid authorization header');
        return res.status(401).json({ error: 'No authentication token provided' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      console.log('Verifying ID token...');
      
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      console.log('Token verified for user:', decodedToken.uid);
      
      const userId = decodedToken.uid;

      // Check if user has paid subscription in Firestore
      console.log('Checking Firestore for user document...');
      try {
        // Use the db reference we created earlier
        const userDoc = await db.collection('users').doc(userId).get();
        
        console.log('User document exists:', userDoc.exists);
        if (userDoc.exists) {
          console.log('User data:', userDoc.data());
          const isAuthorized = userDoc.data().isPaid === true;
          console.log('Authorization result:', isAuthorized);
          return res.status(200).json({ isAuthorized });
        } else {
          // If document doesn't exist, create it with default values
          console.log('Creating new user document');
          await db.collection('users').doc(userId).set({
            email: decodedToken.email,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            isPaid: false, // Default to unpaid
            displayName: decodedToken.name || null,
            photoURL: decodedToken.picture || null
          });
          
          return res.status(200).json({ isAuthorized: false });
        }
      } catch (firestoreError) {
        console.error('Firestore operation error:', firestoreError);
        // Log more details about the Firestore error
        console.error('Firestore error details:', {
          code: firestoreError.code,
          message: firestoreError.message,
          details: firestoreError.details,
          stack: firestoreError.stack
        });
        return res.status(500).json({ 
          error: 'Database operation failed',
          details: firestoreError.message
        });
      }

    } catch (error) {
      console.error('Error checking authorization:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      if (error.code === 'auth/invalid-id-token') {
        return res.status(401).json({ 
          error: 'Invalid authentication token',
          details: error.message
        });
      }
      
      return res.status(500).json({ 
        error: 'Internal server error',
        details: error.message
      });
    }
  });
});