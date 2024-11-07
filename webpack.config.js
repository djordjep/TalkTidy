const path = require('path');
const Dotenv = require('dotenv-webpack');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background.js',
    popup: './src/popup.js',
    content: './src/content.js',
    paywall: './src/paywall.js',
    permissions: './src/permissions.js',
    auth: './src/auth.js',
    'firebase-app': './node_modules/firebase/app',
    'firebase-auth': './node_modules/firebase/auth',
    'firebase-init': './src/firebase-init.js',
    'firebase-config': './src/firebase-config.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    module: true,
    library: {
      type: 'module'
    }
  },
  resolve: {
    extensions: ['.js']
  },
  mode: 'production',
  experiments: {
    outputModule: true,
  },
  plugins: [
    new Dotenv(),
    new CopyPlugin({
      patterns: [
        {
          from: 'manifest.json',
          transform(content) {
            return content
              .toString()
              .replace('process.env.GOOGLE_OAUTH_CLIENT_ID', process.env.GOOGLE_OAUTH_CLIENT_ID);
          },
        },
      ],
    }),
  ]
}; 