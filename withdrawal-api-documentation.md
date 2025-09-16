# Updated Withdrawal API Documentation

## Overview
The withdrawal system now automatically uses KYC account details for withdrawals. Users only need to provide the amount, and the system will fetch their approved KYC bank details.

## API Endpoints

### 1. Request Withdrawal
**Endpoint:** `POST /api/withdrawals/request`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "amount": 5000
}
```

**Requirements:**
- User must be KYC verified (`kycVerified: true`)
- User must have an approved KYC record
- Amount must be between ₹100 - ₹1,00,000
- User must have sufficient balance
- No pending withdrawal requests

**Success Response:**
```json
{
  "success": true,
  "message": "Withdrawal request submitted successfully",
  "data": {
    "id": 1,
    "amount": 5000,
    "method": "bank_transfer",
    "status": "pending",
    "accountDetails": {
      "bankName": "State Bank of India",
      "accountHolderName": "John Doe",
      "accountNumber": "1234****7890",
      "ifscCode": "SBIN0001234"
    },
    "requestedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Amount validation errors, insufficient balance, pending withdrawal exists
- `401`: Unauthorized
- `403`: KYC verification required
- `400`: No approved KYC found

### 2. Get Withdrawal Balance
**Endpoint:** `GET /api/withdrawals/balance`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "kycVerified": true,
    "kycDetails": {
      "bankName": "State Bank of India",
      "accountHolderName": "John Doe",
      "accountNumber": "1234****7890",
      "ifscCode": "SBIN0001234",
      "address": "123 Main Street, City",
      "pincode": "123456"
    },
    "totalIncome": 10000,
    "totalWithdrawn": 2000,
    "availableBalance": 8000,
    "pendingWithdrawal": null
  }
}
```

### 3. Get My Withdrawals
**Endpoint:** `GET /api/withdrawals/my-withdrawals`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by status (pending, approved, rejected, completed)

### 4. Admin Endpoints

#### Get All Withdrawals
**Endpoint:** `GET /api/withdrawals/admin/all`

#### Approve Withdrawal
**Endpoint:** `PUT /api/withdrawals/admin/:withdrawalId/approve`

**Request Body:**
```json
{
  "transactionId": "TXN123456789"
}
```

#### Reject Withdrawal
**Endpoint:** `PUT /api/withdrawals/admin/:withdrawalId/reject`

**Request Body:**
```json
{
  "adminNotes": "Insufficient documentation"
}
```

#### Complete Withdrawal
**Endpoint:** `PUT /api/withdrawals/admin/:withdrawalId/complete`

**Request Body:**
```json
{
  "transactionId": "TXN123456789"
}
```

## Key Changes

1. **Simplified Request**: Only amount is required in request body
2. **Automatic KYC Integration**: System fetches approved KYC bank details
3. **Bank Transfer Only**: All withdrawals use bank transfer method
4. **Enhanced Security**: Uses verified KYC account details only
5. **Better UX**: Users see their account details in responses

## Withdrawal Flow

1. User submits withdrawal request with amount only
2. System validates KYC status and fetches bank details
3. System creates withdrawal request with KYC account details
4. Admin reviews and approves/rejects the request
5. Admin processes the payment to the KYC bank account
6. Withdrawal status updated to completed

## Error Handling

- **KYC Required**: User must have approved KYC to withdraw
- **Balance Validation**: Sufficient balance required
- **Pending Check**: Only one pending withdrawal allowed
- **Amount Limits**: ₹100 minimum, ₹1,00,000 maximum
