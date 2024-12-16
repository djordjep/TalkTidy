# TalkTidy Chrome Extension

A Chrome extension that helps users get clean, concise summaries of YouTube videos using Firebase and Claude AI.

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your Firebase and Google OAuth credentials
4. Build the extension:
```bash
npm run build
```

5. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory from your project

## Development

- Run the development build with watch mode:
```bash
npm run watch
```

- The extension uses Webpack for bundling and supports ES6 modules
- Firebase is used for authentication and backend services

## Project Structure

```
talktidy/
├── src/
│   ├── background.js      # Service worker for extension
│   ├── content.js         # Content script for YouTube interaction
│   ├── auth.js           # Authentication handling
│   ├── paywall.js        # Subscription check
│   ├── firebase-init.js   # Firebase initialization
│   └── firebase-config.js # Firebase configuration
├── functions/
│   └── index.js          # Firebase Cloud Functions
├── public/
│   ├── auth.html         # Authentication page
│   └── paywall.html      # Subscription page
├── styles/
│   └── styles.css        # Extension styles
└── webpack.config.js     # Webpack configuration
```

## Firebase Setup

1. Create a new Firebase project
2. Enable Authentication with Google sign-in
3. Set up Firestore database
4. Deploy the Cloud Functions:
```bash
firebase deploy --only functions
```

## Environment Variables

Create a `.env` file with the following variables:
```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
FIREBASE_APP_ID=your_app_id
GOOGLE_OAUTH_CLIENT_ID=your_oauth_client_id
CLAUDE_API_KEY=your_claude_api_key
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
```

## Stripe Integration

### Setting Up Stripe Payments

1. **Create a Stripe Account:**
   - Sign up for a [Stripe](https://stripe.com/) account if you haven't already.

2. **Obtain Stripe API Keys:**
   - **Publishable Key:** Used in the frontend to redirect users to Stripe Checkout.
   - **Secret Key:** Used in Firebase Cloud Functions to interact with the Stripe API.
   - **Webhook Secret:** Used to verify the authenticity of webhook events sent by Stripe.

3. **Configure Environment Variables:**
   - Add the following to your `.env` file in the main directory:
     ```
     STRIPE_SECRET_KEY=your_stripe_secret_key
     STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
     ```

4. **Set Up Stripe Webhooks:**
   - In the Stripe Dashboard, navigate to Developers > Webhooks.
   - Add a new webhook endpoint pointing to your deployed `stripeWebhook` Cloud Function URL (e.g., `https://us-central1-your-project-id.cloudfunctions.net/stripeWebhook`).
   - Select the following events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.deleted`

5. **Update `webpack.config.js`:**
   - Ensure that `functions/index.js` is correctly copied to the `dist` directory during the build process (as shown above).

6. **Deploy Firebase Cloud Functions:**
   - Deploy your Cloud Functions using:
     ```
     firebase deploy --only functions
     ```

7. **Update Frontend Configuration:**
   - Replace `'your-project-id'` in `src/paywall.js` with your actual Firebase project ID.
   - Replace `'your-publishable-key'` with your Stripe publishable key in `src/paywall.js`.

8. **Include Stripe.js in `paywall.html`:**
   - Add the following script tag before your `paywall.js` script:
     ```html
     <script src="https://js.stripe.com/v3/"></script>
     ```

### Testing the Payment Flow

1. **Initiate Subscription:**
   - Open the Chrome extension and navigate to a YouTube video.
   - Click the "Get Video Transcript" button.
   - If not subscribed, you will be redirected to the `paywall.html` page.
   - Click the "Upgrade Now" button to start the Stripe Checkout process.

2. **Complete Payment:**
   - Complete the payment in Stripe Checkout.
   - After successful payment, you should be redirected to the success URL, and your Firestore `users` collection should reflect the updated subscription status.

3. **Verify Access to Premium Features:**
   - Reopen the Chrome extension to ensure that the premium features are now accessible.

### Notes

- **Security:** Ensure that your Stripe secret keys are kept secure and never exposed in the frontend code.
- **Error Handling:** The provided Cloud Functions include basic error handling. Consider enhancing error management for production environments.
- **Testing Environment:** Use Stripe's test mode and test API keys during development to avoid real charges.

## Setup

1. Copy `.env.example` to `.env` and fill in your credentials
2. Copy `public/secure-payment.template.html` to `public/secure-payment.html` and `public/secure-payment.template.js` to `public/secure-payment.js`, then replace the following placeholders in both files:
   - `YOUR_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key
   - `YOUR_FIREBASE_FUNCTION_URL`: Your Firebase function URL
   - `YOUR_EXTENSION_URL`: Your Chrome extension URL

```

