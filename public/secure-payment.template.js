// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const planType = urlParams.get('plan');
const userToken = urlParams.get('token');

// Initialize Stripe with your publishable key
const stripe = Stripe('YOUR_STRIPE_PUBLISHABLE_KEY');

async function initializePayment() {
    try {
        // Create checkout session using your Firebase function URL
        const response = await fetch('YOUR_FIREBASE_FUNCTION_URL/createCheckoutSession', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({ 
                planType: planType,
                return_url: 'YOUR_EXTENSION_URL/success.html'
            })
        });

        const { sessionId } = await response.json();
        
        // Redirect to Stripe Checkout
        await stripe.redirectToCheckout({ sessionId });
    } catch (error) {
        document.getElementById('payment-container').innerHTML = `
            <div class="error">
                Payment initialization failed. Please try again.
                ${error.message}
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', initializePayment); 