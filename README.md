# TalkTidy Chrome Extension

TalkTidy is a Chrome extension that helps users extract and summarize YouTube video transcripts. It provides clean, concise summaries of long talks or videos, making content consumption more efficient.

## Features

- Extract transcripts from YouTube videos
- Generate AI-powered summaries of video content
- Copy transcripts to clipboard
- User authentication with Google
- Premium features for subscribed users

## Installation

1. Clone the repository:
```bash
git clone https://github.com/djordjep/TalkTidy.git
cd talktidy
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
FIREBASE_APP_ID=your_app_id
GOOGLE_OAUTH_CLIENT_ID=your_oauth_client_id
```

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
- The project includes a Python Cloud Function for processing transcripts

## Project Structure

```
talktidy/
├── src/
│   ├── background.js
│   ├── content.js
│   ├── popup.js
│   ├── auth.js
│   ├── paywall.js
│   ├── firebase-init.js
│   └── firebase-config.js
├── functions/
│   └── main.py
├── public/
│   ├── popup.html
│   ├── auth.html
│   └── paywall.html
├── styles/
│   └── styles.css
└── webpack.config.js
```

## Firebase Setup

1. Create a new Firebase project
2. Enable Authentication with Google sign-in
3. Set up Firestore database
4. Deploy the Cloud Function:
```bash
firebase deploy --only functions
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Privacy Policy

See [Privacy Policy](privacy-policy.md) for information about how we handle user data.

## Terms of Service

See [Terms of Service](terms-of-service.md) for the terms and conditions of using this extension.

## Contact

Djordje Puzic - djordje.puzic@gmail.com

Project Link: [https://github.com/djordjep/TalkTidy](https://github.com/djordjep/TalkTidy)

