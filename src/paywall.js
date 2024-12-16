import { auth } from './firebase-init.js';

document.addEventListener('DOMContentLoaded', async function() {
    const singlePaymentButton = document.getElementById('singlePaymentButton');
    const packPaymentButton = document.getElementById('packPaymentButton');
    
    if (!singlePaymentButton || !packPaymentButton) {
        console.error('Payment buttons not found in paywall.html.');
        return;
    }

    const handlePayment = async (planType) => {
        const button = planType === 'single' ? singlePaymentButton : packPaymentButton;
        
        try {
            button.disabled = true;
            button.textContent = 'Loading...';

            // Get the current user's ID token
            const idToken = await auth.currentUser.getIdToken();

            // Construct the payment URL with parameters
            const paymentUrl = new URL(`${process.env.APP_HOSTING_URL}/secure-payment.html`);
            paymentUrl.searchParams.append('plan', planType);
            paymentUrl.searchParams.append('token', idToken);

            // Open payment page in new tab
            window.open(paymentUrl.toString(), '_blank');

            // Close the paywall popup
            window.close();
        } catch (error) {
            console.error('Payment initiation error:', error);
            alert('Unable to initiate payment. Please try again.');
        } finally {
            button.disabled = false;
            button.textContent = 'Buy Now';
        }
    };

    singlePaymentButton.addEventListener('click', () => handlePayment('single'));
    packPaymentButton.addEventListener('click', () => handlePayment('pack'));
}); 