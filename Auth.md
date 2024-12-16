# Authentication and Authorization Documentation

## Overview

The **TalkTidy Chrome Extension** utilizes Firebase for handling authentication and authorization. This documentation outlines the steps involved in the authentication process, how users are authorized based on their subscription status, and the interaction between various components of the application.

## Overall Login Process

The **TalkTidy Chrome Extension** leverages both Google OAuth and Firebase Authentication to provide a secure and seamless login experience for users.

### Components Used

- **Google OAuth Client:** Enables users to sign in using their Google accounts. This is configured with the `GOOGLE_OAUTH_CLIENT_ID` in the `manifest.src.json` and managed through the Firebase Console.

- **Firebase Authentication:** Handles the authentication flow and manages user sessions. It integrates with Google OAuth to authenticate users and maintain their authentication state across sessions.

### How They Are Connected

1. **User Initiates Sign-In:**
   - When a user clicks the "Sign in with Google" button, the extension uses the Google OAuth Client ID to initiate the OAuth flow via Firebase Authentication.

2. **Authentication Flow:**
   - Firebase Authentication processes the OAuth tokens received from Google, verifies the user's identity, and establishes a secure session.
   - The user's authentication state is persisted locally, ensuring they remain signed in across browser sessions.

3. **Admin Dashboard:**
   - Administrators can manage users and monitor authentication activities through the Firebase Console's Authentication section.
   - The Firebase Admin SDK is used in Cloud Functions (`functions/index.js`) to securely access and manage user data, such as verifying subscription statuses.

### References to External Services

- **Firebase Console:** Provides an admin dashboard for managing authentication, Firestore databases, and Cloud Functions. It allows developers to configure authentication providers, set up security rules, and monitor application usage.

- **Google Cloud Platform (GCP):** Hosts Firebase services and provides additional tools and services that can be integrated with the TalkTidy extension for enhanced functionality and scalability.

By integrating Google OAuth with Firebase Authentication, the TalkTidy extension ensures that user authentication is both secure and user-friendly, while also providing developers with powerful tools to manage and monitor the authentication flow effectively.

## Authentication Process

### 1. User Initiates Sign-In

- **Trigger:** The user clicks the "Sign in with Google" button in the extension's popup (`popup.html`).
  
- **File Involved:** `src/popup.js`

- **Process:**
  - The `signInButton` in `popup.js` listens for click events.
  - Upon clicking, it calls the `handleGoogleAuth()` function, which sends a message to the background script to handle the authentication via Firebase.

### 2. Handling Sign-In with Firebase

- **Files Involved:** 
  - `src/popup.js`
  - `src/background.js`
  - `src/firebase-init.js`
  - `src/auth.js`

- **Process:**
  - The `handleGoogleAuth()` function in `popup.js` communicates with the `background.js` script using `chrome.runtime.sendMessage`.
  - The `background.js` script listens for messages of type `GOOGLE_API_REQUEST` and action `AUTH`.
  - It utilizes Firebase Authentication to initiate the Google sign-in flow using `GoogleAuthProvider` and `signInWithPopup` methods.
  - Upon successful authentication, Firebase returns a user object, and the authentication state is updated.

### 3. Persisting Authentication State

- **File Involved:** `src/firebase-init.js`

- **Process:**
  - Firebase is initialized with the configuration from `firebase-config.js`.
  - Authentication persistence is set to `local` using `setPersistence(auth, browserLocalPersistence)`, ensuring that the user's authentication state is maintained across browser sessions.

### 4. Updating the UI Based on Authentication State

- **File Involved:** `src/popup.js`

- **Process:**
  - The `onAuthStateChanged` listener monitors changes in the user's authentication state.
  - If the user is signed in, the extension checks whether the user has a paid subscription by calling `checkUserAuthorization(user.uid)`.
  - Depending on the authorization status:
    - **Authorized:** Shows the "Get Summary" button and hides the sign-in section.
    - **Not Authorized:** Prompts the user to subscribe by displaying the sign-in section and potentially redirecting to the paywall.

## Authorization Process

### 1. Checking Subscription Status

- **Files Involved:** 
  - `src/popup.js`
  - `functions/index.js`
  
- **Process:**
  - After authentication, the extension sends a request to Firebase Cloud Functions to verify if the authenticated user has an active paid subscription.
  - The `processTranscript` and `checkAuthorization` functions in `functions/index.js` handle these requests.
  - The Cloud Functions verify the user's ID token and check the `isPaid` field in the user's Firestore document.

### 2. Firestore Security Rules

- **File Involved:** `firestore.rules`

- **Rules:**  ```firestore.rules
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{userId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }   ```

- **Explanation:**
  - Users can read and write their own documents in the `users` collection.
  - Ensures that users cannot access or modify other users' data.

### 3. Handling Authorization Response

- **Files Involved:** 
  - `src/popup.js`
  - `functions/index.js`
  - `src/paywall.js`
  
- **Process:**
  - If the user is authorized (`isPaid: true`), they can access premium features like generating summaries.
  - If not authorized, the extension prompts the user to subscribe by redirecting them to the `paywall.html` page.

### 4. Subscription Payment via Stripe

- **Files Involved:**
  - `paywall.html`
  - `src/paywall.js`
  - `functions/index.js`
  
- **Process:**
  1. **Initiate Payment:**
     - When an unauthorized user attempts to access premium features, they are redirected to the `paywall.html` page.
     - The `paywall.html` contains an "Upgrade Now" button (`paymentButton`) that the user clicks to initiate the subscription process.
  
  2. **Create Checkout Session:**
     - Upon clicking the "Upgrade Now" button, `src/paywall.js` sends a POST request to the `createCheckoutSession` Firebase Cloud Function, passing the user's UID.
     - The Cloud Function interacts with the Stripe API to create a new Checkout Session, specifying subscription details and callback URLs.
  
  3. **Redirect to Stripe Checkout:**
     - The extension receives the `sessionId` from the Cloud Function and redirects the user to the Stripe Checkout page using Stripe.js.
  
  4. **Handle Webhooks:**
     - After a successful payment, Stripe sends a webhook event (`checkout.session.completed`) to the `stripeWebhook` Firebase Cloud Function.
     - The Cloud Function verifies the event's authenticity and updates the user's Firestore document (`isPaid: true`) to reflect the active subscription.
  
  5. **Update UI Based on Subscription:**
     - Once the subscription status is updated, the user can access premium features.
     - The `onAuthStateChanged` listener in `src/popup.js` detects the change and updates the UI accordingly, hiding the sign-in section and displaying premium options.

### 5. Managing Subscriptions

- **Files Involved:**
  - `functions/index.js`
  - `firestore.rules`
  
- **Process:**
  - **Subscription Status Management:**
    - The user's subscription status is stored in the Firestore `users` collection with fields like `isPaid`, `subscriptionId`, and `subscriptionStatus`.
  
  - **Security Rules:**
    - Firestore rules ensure that only authenticated users can read/write their own subscription data.
    - Example:
      ```firestore.rules
      rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          match /users/{userId} {
            allow read, write: if request.auth != null && request.auth.uid == userId;
          }
        }
      }
      ```
  
  - **Subscription Lifecycle:**
    - The `stripeWebhook` function listens for subscription events (e.g., `customer.subscription.deleted`) to automatically update the user's subscription status in Firestore, ensuring real-time reflection of their subscription state.

## Key Components Interaction

- **Frontend (Popup):** Handles user interactions, initiates sign-in, and requests authorization checks.
  
- **Background Script:** Manages authentication flows and communicates with Firebase services.
  
- **Firebase Cloud Functions:** Serve as the backend to process transcripts and verify user subscriptions.
  
- **Firestore Database:** Stores user data, including subscription status (`isPaid`).

## Environment Variables

Ensure the following environment variables are set in the `.env` file to facilitate authentication and authorization: 

```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
FIREBASE_APP_ID=your_app_id
GOOGLE_OAUTH_CLIENT_ID=your_oauth_client_id
CLAUDE_API_KEY=your_claude_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

### Stripe Dashboard and Firebase Console

- **Stripe Dashboard:**
  - Manage your products, prices, and view transaction logs.
  - Obtain your `STRIPE_SECRET_KEY` and set up webhook endpoints pointing to your `stripeWebhook` Cloud Function.
  
- **Firebase Console:**
  - Deploy and monitor your Cloud Functions (`createCheckoutSession` and `stripeWebhook`).
  - Manage Firestore data and security rules to ensure proper authorization.

## Summary

The **TalkTidy Chrome Extension** incorporates a comprehensive authentication and authorization system leveraging Google OAuth, Firebase Authentication, and Stripe for subscription management. Users authenticate via Google Sign-In, and their subscription status is managed through Stripe-integrated Cloud Functions. This setup ensures secure access control, seamless user experience, and efficient management of premium features based on user subscriptions.