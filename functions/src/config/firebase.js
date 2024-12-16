import admin from 'firebase-admin';
import { defineString } from 'firebase-functions/params';

// Initialize Firebase Admin with explicit project configuration
admin.initializeApp();

// Initialize Firestore
const db = admin.firestore();

// Define global parameters
export const projectId = defineString('PROJECT_ID');

export { admin, db }; 