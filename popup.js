document.getElementById('signInButton').addEventListener('click', async () => {
  const userInfoDiv = document.getElementById('userInfo');
  
  try {
    // Get auth token with correct parameter structure
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ 
        interactive: true
      }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });

    userInfoDiv.textContent = `Token obtained: ${token.substring(0, 5)}...`;

    // Get user info
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    userInfoDiv.textContent = `Logged in as: ${data.email}`;
    
    // Log full response for debugging
    console.log('User info:', data);

  } catch (error) {
    userInfoDiv.textContent = `Error: ${error.message}`;
    console.error('Auth error:', error);
  }
}); 