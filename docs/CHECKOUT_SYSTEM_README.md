# Checkout Page and Order Creation System

## Overview
This document describes the Checkout Page and Order Creation system built with MERN stack (MongoDB, Express, React, Node.js).

## Frontend (React + Tailwind CSS)

### Checkout Page (`/checkout`)

#### Features:
- Retrieves selected tickets from localStorage
- Displays event name, ticket categories, quantities, prices, and total amount
- Buyer information form (Full Name, Email, Phone Number)
- "Confirm & Continue" button with validation
- Clean two-column layout (form left, summary right)
- Loading states and error handling

#### Data Flow:
1. Load checkout data from localStorage
2. Display order summary and buyer form
3. Validate form inputs
4. Send order data to backend API
5. Redirect to confirmation page on success

#### Sample localStorage Structure:
```javascript
{
  eventId: "507f1f77bcf86cd799439011",
  eventName: "Summer Music Festival",
  selectedTickets: {
    "vip-001": 2,
    "general-001": 1
  },
  categories: [
    {
      id: "vip-001",
      name: "VIP",
      price: 5000
    },
    {
      id: "general-001",
      name: "General",
      price: 2000
    }
  ]
}
```

## Backend (Node.js + Express + MongoDB)

### Order Model
```javascript
{
  orderNumber: String (unique, auto-generated),
  eventId: ObjectId (ref Event),
  buyerName: String (required),
  buyerEmail: String (required, lowercase),
  buyerPhone: String,
  tickets: [{
    categoryName: String (required),
    quantity: Number (required, min: 1),
    price: Number (required, min: 0)
  }],
  totalAmount: Number (required, min: 0),
  status: String (enum: ['PENDING', 'CONFIRMED', 'CANCELLED']),
  confirmationToken: String (UUID, unique),
  createdAt: Date
}
```

### API Endpoints

#### POST /api/orders
Create a new order.

**Request Body:**
```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "buyerName": "John Doe",
  "buyerEmail": "john@example.com",
  "buyerPhone": "+1234567890",
  "tickets": [
    {
      "categoryName": "VIP",
      "quantity": 2,
      "price": 5000
    },
    {
      "categoryName": "General",
      "quantity": 1,
      "price": 2000
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "507f1f77bcf86cd799439012",
    "orderNumber": "ORD-A1B2C3D4",
    "confirmationToken": "uuid-string-here",
    "totalAmount": 12000
  },
  "message": "Order created successfully"
}
```

#### GET /api/orders/confirm/:token
Get order details by confirmation token.

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "orderNumber": "ORD-A1B2C3D4",
      "buyerName": "John Doe",
      "buyerEmail": "john@example.com",
      "totalAmount": 12000,
      "status": "PENDING",
      "tickets": [
        {
          "categoryName": "VIP",
          "quantity": 2,
          "price": 5000
        }
      ]
    },
    "tickets": [...]
  }
}
```

### Validation & Security
- Input validation using express-validator
- Server-side total calculation (doesn't trust frontend prices)
- Event and ticket availability checking
- UUID generation for confirmation tokens
- Mongoose schema validation

### Error Handling
- 400: Validation errors
- 404: Event not found
- 500: Internal server errors

## Folder Structure

### Backend
```
backend/
├── src/
│   ├── models/
│   │   └── Order.js          # Order schema
│   ├── routes/
│   │   └── orders.js         # Order API routes
│   ├── middleware/
│   │   └── errorHandler.js   # Error handling middleware
│   └── server.js             # Main server file
├── package.json
└── README.md
```

### Frontend
```
frontend/
├── src/
│   ├── pages/
│   │   └── buyer/
│   │       └── CheckoutPage.jsx    # Checkout page component
│   ├── api/
│   │   └── orders.js              # Order API client
│   ├── components/
│   │   ├── ui/
│   │   │   └── Button.jsx         # Reusable button component
│   │   └── layout/
│   │       └── PublicLayout.jsx   # Layout wrapper
│   └── context/                   # React context (if needed)
├── package.json
└── README.md
```

## Usage

### Frontend Integration
```javascript
import { createOrder } from '../../api/orders';

// In your component
const handleSubmit = async () => {
  try {
    const response = await createOrder(orderData);
    navigate(`/confirm/${response.data.data.confirmationToken}`);
  } catch (error) {
    console.error('Order failed:', error);
  }
};
```

### Backend Integration
```javascript
const express = require('express');
const router = express.Router();
const orderRoutes = require('./routes/orders');

app.use('/api/orders', orderRoutes);
```

## Dependencies

### Backend
- express
- mongoose
- uuid
- express-validator
- cors

### Frontend
- react
- react-router-dom
- axios
- react-hot-toast
- tailwindcss

## Testing

1. Start the backend server
2. Start the frontend development server
3. Navigate to an event page
4. Select tickets
5. Go to checkout
6. Fill buyer information
7. Submit order
8. Verify redirect to confirmation page</content>
<parameter name="filePath">c:\Users\ThinuUpadya\Downloads\EAMS_Full_Project\eams\CHECKOUT_SYSTEM_README.md