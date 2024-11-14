import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

console.log('Firebase initialized with config:', firebaseConfig); // Debugging log

// Set persistence to local
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('Authentication persistence set to local.');
  })
  .catch((error) => {
    console.error('Error setting authentication persistence:', error);
  });

export { auth, app };