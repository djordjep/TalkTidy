const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { OAuth2Client } = require('google-auth-library');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Initialize OAuth client
const client = new OAuth2Client();

exports.createCustomToken = functions
  .runWith({
    timeoutSeconds: 300,
    memory: '256MB'
  })
  .https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(204).send('');
      return;
    }

    try {
      const { googleToken, email } = req.body;
      
      if (!googleToken || !email) {
        throw new Error('Missing required parameters');
      }

      // Verify the Google token
      const ticket = await client.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID // Make sure this matches your OAuth client ID
      });

      const payload = ticket.getPayload();
      
      // Verify the email matches
      if (payload.email !== email) {
        throw new Error('Email mismatch');
      }

      // Create or get Firebase user
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(email);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          userRecord = await admin.auth().createUser({
            email: email,
            emailVerified: payload.email_verified
          });
        } else {
          throw error;
        }
      }

      // Create custom token
      const customToken = await admin.auth().createCustomToken(userRecord.uid);
      
      res.json({ customToken });
    } catch (error) {
      console.error('Error creating custom token:', error);
      res.status(500).json({ error: error.message || 'Failed to create custom token' });
    }
}); 