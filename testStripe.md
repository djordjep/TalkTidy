Stripe provides test card numbers that you can use in test mode. Here are the most commonly used test cards:

**Test Card Numbers:**
```
4242 4242 4242 4242 - Successful payment
4000 0000 0000 3220 - 3D Secure 2 authentication
4000 0000 0000 9995 - Declined payment (insufficient funds)
4000 0000 0000 0341 - Attaches a pending charge
4000 0027 6000 3184 - Requires authentication
```

For all test cards:
- Expiry date: Any future date
- CVV: Any 3 digits
- ZIP/Postal: Any 5 digits

**Testing Specific Scenarios:**
1. **International Cards:**
```
4000 0000 0000 0077 - US card (USD)
4000 0000 0000 0093 - European card (EUR)
4000 0000 0000 0036 - Australian card (AUD)
```

2. **Error Testing:**
```
4000 0000 0000 0002 - Card declined
4000 0000 0000 9987 - Card declined (lost card)
4000 0000 0000 0069 - Expired card
```

To use these:
1. Make sure you're in test mode in Stripe Dashboard
2. Your API key should start with `sk_test_`
3. Test payments won't actually charge any real money

You can find more test cards in the [Stripe testing documentation](https://stripe.com/docs/testing) for specific scenarios like different currencies or payment error cases.