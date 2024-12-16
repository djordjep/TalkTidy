import { onRequest } from 'firebase-functions/v2/https';
import { admin } from '../config/firebase.js';
import { PRODUCT_CREDITS } from '../utils/constants.js';
import Stripe from 'stripe';
import { defineSecret } from 'firebase-functions/params';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

export const createCheckoutSession = onRequest(
    {
        secrets: [stripeSecretKey],
        cors: true,
        maxInstances: 10
    },
    async (request, response) => {
        const stripe = new Stripe(stripeSecretKey.value(), {});

        if (request.method !== 'POST') {
            return response.status(405).json({ error: 'Method not allowed' });
        }

        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('Invalid auth header:', authHeader ? 'Present but invalid' : 'Missing');
            return response.status(401).json({ error: 'Unauthorized - Invalid auth header' });
        }

        const idToken = authHeader.split('Bearer ')[1].trim();

        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const userId = decodedToken.uid;
            console.log('Token verified for user:', userId);

            // Verify Stripe configuration
            if (!stripeSecretKey.value()) {
                console.error('Stripe secret key is not configured');
                return response.status(500).json({ error: 'Stripe configuration error' });
            }

            // Create Stripe Checkout Session with explicit price ID
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: PRODUCT_CREDITS.price_8credits,
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                metadata: {
                    uid: userId,
                },
                success_url: `${process.env.APP_HOSTING_URL}/success.html`,
                cancel_url: `${process.env.APP_HOSTING_URL}/cancel.html`,
            });

            console.log('Checkout session created:', session.id);
            return response.status(200).json({ sessionId: session.id });

        } catch (authError) {
            console.error('Auth error details:', {
                name: authError.name,
                message: authError.message,
                code: authError.code,
                stack: authError.stack
            });
            return response.status(401).json({
                error: 'Authentication failed',
                details: authError.message,
                code: authError.code
            });
        }
    }
);