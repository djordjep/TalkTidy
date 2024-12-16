import { onRequest } from 'firebase-functions/v2/https';
import { admin } from '../config/firebase.js';
import { PRODUCT_CREDITS } from '../utils/constants.js';
import Stripe from 'stripe';
import { defineSecret } from 'firebase-functions/params';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

export const stripeWebhook = onRequest(
    {
        secrets: [stripeSecretKey, stripeWebhookSecret],
        maxInstances: 10
    },
    async (req, res) => {
        const sig = req.headers['stripe-signature'];
        let event;
        const stripe = new Stripe(stripeSecretKey.value(), {});

        try {
            event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Log the event for debugging
        console.log('Received webhook event:', event.type);

        try {
            switch (event.type) {
                case 'checkout.session.completed':
                    const session = event.data.object;
                    const metadata = session.metadata;

                    if (!metadata.uid) {
                        console.error('No user ID found in session metadata');
                        return res.status(400).send('No user ID in metadata');
                    }

                    // Get the price ID from the session
                    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
                    const priceId = lineItems.data[0].price.id;
                    
                    // Map price IDs to credit amounts
                    const creditsToAdd = priceId === PRODUCT_CREDITS.price_8credits ? 8 : 1;

                    const userRef = admin.firestore().collection('users').doc(metadata.uid);
                    
                    // Create the transaction object with a regular timestamp
                    const transaction = {
                        type: 'purchase',
                        credits: creditsToAdd,
                        amount: session.amount_total,
                        date: new Date().toISOString(),
                        paymentId: session.payment_intent,
                        sessionId: session.id
                    };

                    // Update credits and add transaction in one atomic operation
                    await userRef.update({
                        credits: admin.firestore.FieldValue.increment(creditsToAdd),
                        transactions: admin.firestore.FieldValue.arrayUnion(transaction),
                        isPaid: true,
                        lastPaymentDate: new Date().toISOString()
                    });

                    console.log(`Payment succeeded for user ${metadata.uid}, added ${creditsToAdd} credits and updated paid status`);
                    break;

                case 'payment_intent.payment_failed':
                    const failedPayment = event.data.object;
                    const failedMetadata = failedPayment.metadata;

                    // Log the failed payment attempt
                    await admin.firestore().collection('users').doc(failedMetadata.uid).update({
                        paymentStatus: 'failed',
                        lastFailedPayment: {
                            date: admin.firestore.FieldValue.serverTimestamp(),
                            error: failedPayment.last_payment_error?.message || 'Unknown error'
                        }
                    });

                    console.log(`Payment failed for user ${failedMetadata.uid}`);
                    break;

                case 'charge.succeeded':
                    const charge = event.data.object;
                    // Additional charge success handling if needed
                    console.log('Charge succeeded:', charge.id);
                    break;

                case 'charge.failed':
                    const failedCharge = event.data.object;
                    // Additional charge failure handling if needed
                    console.log('Charge failed:', failedCharge.id);
                    break;

                default:
                    console.log(`Unhandled event type ${event.type}`);
            }

            res.json({ received: true });
        } catch (error) {
            console.error('Error processing webhook:', error);
            res.status(500).send('Webhook processing failed');
        }
    }
);