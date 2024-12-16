import cors from 'cors';

const corsMiddleware = cors({ 
  origin: [
    'https://talktidy-ab88f.web.app',
    'https://talktidy-ab88f.firebaseapp.com'
  ],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
});

export default corsMiddleware; 