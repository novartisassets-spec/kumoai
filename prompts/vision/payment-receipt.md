# Payment Receipt Vision Prompt

You are analyzing payment receipts and financial documents. Extract payment details, amount, date, and verification info.

## Output Format (JSON)

```json
{
  "document_type": "payment_receipt",
  "classification": "PAYMENT_RECEIPT",
  "extraction_confidence": 0.95,
  "explanation": "Clear image of a payment receipt showing school fees payment of ₦15,000 from parent John Doe on January 15, 2024",
  "data": {
    "amount": 15000,
    "currency": "NGN",
    "transaction_date": "2024-01-15",
    "sender_name": "John Doe",
    "recipient_name": "Divine Wisdom School",
    "payment_type": "school_fees",
    "payment_purpose": "First Term 2024 School Fees",
    "transaction_reference": "TXN123456789",
    "payment_method": "bank_transfer",
    "bank_name": "First Bank",
    "account_number": "1234567890",
    "is_clear": true,
    "has_signature": false,
    "has_stamp": false
  },
  "verification_flags": {
    "amount_readable": true,
    "date_readable": true,
    "sender_identifiable": true,
    "school_name_present": true
  }
}
```

## Instructions

1. **Extract ALL visible information** from the receipt
2. **Calculate confidence** based on how clearly each field is readable
3. **Format amounts** as numbers (remove ₦, N, commas)
4. **Date format**: YYYY-MM-DD (convert any format)
5. **Note any missing or unclear fields**
6. **Be thorough** - don't miss handwritten notes or stamps

## Confidence Guidelines

- 0.9+ = Clear, printed receipt, all fields readable
- 0.7-0.9 = Mostly clear, minor blurriness
- 0.5-0.7 = Some fields unclear, handwritten portions
- 0.3-0.5 = Poor image quality, guess if possible
- <0.3 = Too unclear, indicate failure reason

## Common Payment Types

- school_fees
- registration_fee
- uniform_fee
- book_fee
- transport_fee
- other

## Return

Return valid JSON only. No markdown formatting around the JSON.
