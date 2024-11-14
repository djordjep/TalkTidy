import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase-init.js';

console.log('auth.js script loaded and initializing sign-in listener'); // Debugging log

document.getElementById('signInWithGoogle').addEventListener('click', async () => {
  console.log('Sign in with Google button clicked'); // Debugging log

  try {
    const provider = new GoogleAuthProvider();
    console.log('GoogleAuthProvider initialized:', provider); // Debugging log

    await signInWithPopup(auth, provider);
    console.log('User signed in successfully'); // Debugging log

    window.close();
  } catch (error) {
    console.error('Auth Error:', error);
    alert('Authentication failed. Please try again.');
  }
}); 