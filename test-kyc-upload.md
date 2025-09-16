# KYC Image Upload API Documentation

## Submit KYC Request with Images

**Endpoint:** `POST /api/kyc/submit`

**Content-Type:** `multipart/form-data`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Form Data Fields:**
- `panNumber` (optional): PAN number
- `aadhaarNumber` (optional): Aadhaar number  
- `accountNumber` (required): Bank account number
- `ifscCode` (required): IFSC code
- `bankName` (required): Bank name
- `accountHolderName` (required): Account holder name
- `address` (optional): User address
- `pincode` (optional): 6-digit pincode
- `parentImage` (optional): Parent document image file
- `childImage` (optional): Child document image file

**File Upload Requirements:**
- At least one image (parent or child) must be provided
- Supported formats: PNG, JPG, JPEG, WEBP, GIF, AVIF
- Maximum file size: 10MB per image
- Images are automatically saved to `/uploads` folder
- Database stores the public URL path

**Example using curl:**
```bash
curl -X POST http://localhost:5000/api/kyc/submit \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "panNumber=ABCDE1234F" \
  -F "aadhaarNumber=123456789012" \
  -F "accountNumber=1234567890" \
  -F "ifscCode=SBIN0001234" \
  -F "bankName=State Bank of India" \
  -F "accountHolderName=John Doe" \
  -F "address=123 Main Street, City" \
  -F "pincode=123456" \
  -F "parentImage=@/path/to/parent-document.jpg" \
  -F "childImage=@/path/to/child-document.jpg"
```

**Example using JavaScript FormData:**
```javascript
const formData = new FormData();
formData.append('panNumber', 'ABCDE1234F');
formData.append('aadhaarNumber', '123456789012');
formData.append('accountNumber', '1234567890');
formData.append('ifscCode', 'SBIN0001234');
formData.append('bankName', 'State Bank of India');
formData.append('accountHolderName', 'John Doe');
formData.append('address', '123 Main Street, City');
formData.append('pincode', '123456');
formData.append('parentImage', parentImageFile);
formData.append('childImage', childImageFile);

fetch('/api/kyc/submit', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
});
```

**Success Response:**
```json
{
  "success": true,
  "message": "KYC request submitted successfully",
  "data": {
    "id": 1,
    "status": "pending",
    "submittedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Validation errors (missing required fields, invalid file format, etc.)
- `401`: Unauthorized (invalid or missing token)
- `403`: KYC verification required for withdrawals
- `500`: Server error
