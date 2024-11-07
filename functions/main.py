# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

import os
from typing import Dict, Any
from firebase_functions import https_fn
from firebase_admin import initialize_app, auth, firestore
from firebase_functions.params import SecretParam
import anthropic
import json
import logging

# Initialize Firebase Admin
initialize_app()
db = firestore.client()

# Initialize environment variables
CLAUDE_API_KEY = SecretParam('CLAUDE_API_KEY')

@https_fn.on_request()
async def process_transcript(req: https_fn.Request) -> https_fn.Response:
    # Check if request method is POST
    if req.method != 'POST':
        return https_fn.Response(
            json.dumps({'error': 'Only POST requests are allowed'}),
            status=405,
            content_type='application/json'
        )

    try:
        # Verify Firebase Auth token
        auth_header = req.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return https_fn.Response(
                json.dumps({'error': 'No authentication token provided'}),
                status=401,
                content_type='application/json'
            )

        id_token = auth_header.split('Bearer ')[1]
        decoded_token = auth.verify_id_token(id_token)
        user_id = decoded_token['uid']

        # Check if user has paid subscription
        user_doc = await db.collection('users').document(user_id).get()
        if not user_doc.exists or not user_doc.to_dict().get('isPaid', False):
            return https_fn.Response(
                json.dumps({'error': 'Subscription required'}),
                status=403,
                content_type='application/json'
            )

        # Get transcript from request body
        request_data = req.get_json()
        if not request_data or 'transcript' not in request_data:
            return https_fn.Response(
                json.dumps({'error': 'No transcript provided'}),
                status=400,
                content_type='application/json'
            )

        transcript = request_data['transcript']

        # Process transcript with Claude AI
        client = anthropic.Client(api_key=CLAUDE_API_KEY.value)
        message = await client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": transcript
            }]
        )

        # Return Claude's response
        return https_fn.Response(
            json.dumps({
                'success': True,
                'response': message.content[0].text
            }),
            status=200,
            content_type='application/json'
        )

    except auth.InvalidIdTokenError:
        return https_fn.Response(
            json.dumps({'error': 'Invalid authentication token'}),
            status=401,
            content_type='application/json'
        )
    except Exception as e:
        logging.error(f"Error processing request: {str(e)}")
        return https_fn.Response(
            json.dumps({'error': 'Internal server error'}),
            status=500,
            content_type='application/json'
        )