import { onRequest } from 'firebase-functions/v2/https';
import { processTranscript } from './src/handlers/processTranscript.js';
import { checkAuthorization } from './src/handlers/checkAuthorization.js';
import { createCheckoutSession } from './src/handlers/createCheckoutSession.js';
import { stripeWebhook } from './src/handlers/stripeWebhook.js';

export { processTranscript, checkAuthorization, createCheckoutSession, stripeWebhook };