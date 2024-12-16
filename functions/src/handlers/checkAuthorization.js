import { onRequest } from 'firebase-functions/v2/https';
import { admin, db } from '../config/firebase.js';

export const checkAuthorization = onRequest(
    {
        cors: true,
        maxInstances: 10
    },
    async (req, res) => {
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
                    const userData = userDoc.data();
                    // Check both isPaid status and credits
                    const isAuthorized = userData.isPaid === true && (userData.credits || 0) > 0;
                    console.log('Authorization result:', isAuthorized, {
                        isPaid: userData.isPaid,
                        credits: userData.credits
                    });
                    return res.status(200).json({ 
                        isAuthorized,
                        credits: userData.credits || 0,
                        isPaid: userData.isPaid || false
                    });
                } else {
                    // If document doesn't exist, create it with default values
                    console.log('Creating new user document');
                    await db.collection('users').doc(userId).set({
                        email: decodedToken.email,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        isPaid: false,
                        credits: 0,
                        displayName: decodedToken.name || null,
                        photoURL: decodedToken.picture || null
                    });

                    return res.status(200).json({ 
                        isAuthorized: false,
                        credits: 0,
                        isPaid: false
                    });
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
