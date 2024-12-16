import { onRequest } from 'firebase-functions/v2/https';
import { admin, db } from '../config/firebase.js';
import cors from '../utils/cors.js';
import { SummarizationService } from '../services/summarizationService.js';
import { defineSecret } from 'firebase-functions/params';

const claudeApiKey = defineSecret('CLAUDE_API_KEY');
const openaiApiKey = defineSecret('OPENAI_API_KEY');

export const processTranscript = onRequest(
    {
        secrets: [claudeApiKey, openaiApiKey],
        cors: true,
        maxInstances: 10
    },
    async (req, res) => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Only POST requests are allowed' });
        }

        // Initialize summarization service
        const summarizer = new SummarizationService(
            claudeApiKey.value(),
            openaiApiKey.value()
        );

        // Create a log reference at the start
        let logRef;

        try {
            // Verify Firebase Auth token
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'No authentication token provided' });
            }

            const idToken = authHeader.split('Bearer ')[1];
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const userId = decodedToken.uid;

            // Check if user has credits
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists || !userDoc.data().credits || userDoc.data().credits < 1) {
                return res.status(403).json({ error: 'No credits available' });
            }

            // Get transcript and videoId from request body
            const { transcript, videoId } = req.body;
            if (!transcript) {
                return res.status(400).json({ error: 'No transcript provided' });
            }
            if (!videoId) {
                return res.status(400).json({ error: 'No videoId provided' });
            }

            // Initialize the log entry
            logRef = db.collection('transcriptLogs').doc();
            const timestamp = admin.firestore.FieldValue.serverTimestamp();
            const logData = {
                userId,
                userEmail: decodedToken.email,
                timestamp,
                transcriptLength: transcript.length,
                transcript,
                creditsBeforeRequest: userDoc.data().credits,
                status: 'processing',
                requestMetadata: {
                    userAgent: req.headers['user-agent'],
                    ipAddress: req.ip,
                    timestamp: timestamp
                }
            };

            // Start the log entry
            await logRef.set(logData);

            // Check cache first
            const cachedTranscriptRef = await db.collection('cachedTranscripts').doc(videoId).get();
            if (cachedTranscriptRef.exists) {
                const cachedData = cachedTranscriptRef.data();
                
                // Update log with cache hit
                await logRef.update({
                    status: 'completed',
                    cacheHit: true,
                    summary: cachedData.summary,
                    provider: cachedData.provider,
                    completionTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                    success: true
                });

                return res.status(200).json({
                    success: true,
                    response: cachedData.summary,
                    provider: cachedData.provider,
                    creditsRemaining: userDoc.data().credits,
                    cacheHit: true,
                    logId: logRef.id
                });
            }

            // Process transcript with Claude AI
            try {
                const { summary, provider } = await summarizer.summarize(transcript);

                // Get the current timestamp in milliseconds
                const startTime = Date.now();

                // Store in cache
                await db.collection('cachedTranscripts').doc(videoId).set({
                    summary,
                    provider,
                    transcript,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    transcriptLength: transcript.length,
                    usageCount: 1
                });

                // Deduct credit and log usage
                await db.collection('users').doc(userId).update({
                    credits: admin.firestore.FieldValue.increment(-1),
                    transactions: admin.firestore.FieldValue.arrayUnion({
                        type: 'usage',
                        credits: -1,
                        date: new Date().toISOString(),
                        transcriptLength: transcript.length,
                        provider,
                        logId: logRef.id,
                        videoId
                    })
                });

                // Update the log entry
                await logRef.update({
                    status: 'completed',
                    summary,
                    provider,
                    completionTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                    creditsAfterRequest: userDoc.data().credits - 1,
                    processingTimeMs: Date.now() - startTime,
                    success: true,
                    videoId,
                    cacheHit: false
                });

                return res.status(200).json({
                    success: true,
                    response: summary,
                    provider,
                    creditsRemaining: (userDoc.data().credits || 0) - 1,
                    cacheHit: false,
                    logId: logRef.id
                });
            } catch (error) {
                console.error('Summarization error:', error);
                throw error;
            }

        } catch (error) {
            console.error('Error processing request:', error);

            // If we have a logRef, update it with the error information
            if (typeof logRef !== 'undefined') {
                await logRef.update({
                    status: 'error',
                    error: {
                        message: error.message,
                        code: error.code,
                        stack: error.stack,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    }
                });
            }

            if (error.code === 'auth/invalid-id-token') {
                return res.status(401).json({ error: 'Invalid authentication token' });
            }

            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);