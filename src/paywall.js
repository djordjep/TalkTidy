import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase-init.js';

document.getElementById('signInWithGoogle').addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    window.close();
  } catch (error) {
    console.error('Auth Error:', error);
    alert('Authentication failed. Please try again.');
  }
}); 