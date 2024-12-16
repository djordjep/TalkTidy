import OpenAI from 'openai';
import { defineSecret } from 'firebase-functions/params';

const openaiApiKey = defineSecret('OPENAI_API_KEY');

export const initializeOpenAI = (apiKey) => {
  return new OpenAI({
    apiKey: apiKey,
  });
}; 