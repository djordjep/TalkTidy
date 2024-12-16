const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const Dotenv = require('dotenv-webpack');

require('dotenv').config();

module.exports = {
  entry: {
    background: './src/background.js',
    content: './src/content.js',
    auth: './src/auth.js',
    popup: './src/popup.js',
    paywall: './src/paywall.js',
    'firebase-app': './node_modules/firebase/app',
    'firebase-auth': './node_modules/firebase/auth',
    'firebase-init': './src/firebase-init.js',
    'firebase-config': './src/firebase-config.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  resolve: {
    extensions: ['.js']
  },
  mode: 'production',
  devtool: 'source-map',
  optimization: {
    minimize: true
  },
  experiments: {
    outputModule: true,
  },
  plugins: [
    new Dotenv({
      systemvars: true,
      safe: true
    }),
    new CopyPlugin({
      patterns: [
        {
          from: 'manifest.src.json',
          to: 'manifest.json',
          transform(content) {
            return content
              .toString()
              .replace('GOOGLE_OAUTH_CLIENT_ID', process.env.GOOGLE_OAUTH_CLIENT_ID);
          },
        },
        { from: 'images', to: 'images' },
        { from: 'popup.html', to: 'popup.html' },
        { from: 'auth.html', to: 'auth.html' },
        { from: 'paywall.html', to: 'paywall.html' },
        { from: 'styles.css', to: 'styles.css' },
      ],
    }),
  ]
}; 