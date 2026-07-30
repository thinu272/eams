# 15_ENVIRONMENT_CONFIGURATION

## Overview
The application relies on a set of environment variables and a `SystemConfig` collection to control runtime behavior. Sensitive values are never committed to source control; placeholders are provided in `.env.example`.

### 1. .env Files
- **Backend `.env`** (located at `backend/.env`):
```
# Core
PORT=5000
MONGODB_URI=mongodb://localhost:27017/eams
JWT_SECRET=your_jwt_secret_here

# Payment Gateways
STRIPE_SECRET_KEY=sk_test_...
PAYHERE_MERCHANT_ID=1234567
PAYHERE_SECRET=your_payhere_secret

# Twilio (SMS/WhatsApp)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890

# Frontend URL (used for email links)
FRONTEND_URL=http://localhost:3000

# Optional overrides for production
NODE_ENV=development
```
- **Frontend `.env`** (located at `frontend/.env`):
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_FRONTEND_URL=http://localhost:3000
```

### 2. SystemConfig Collection
`backend/src/models/SystemConfig.js` stores runtime‑editable configuration that can be changed without redeploying.
| Section | Key | Description | Default |
|---------|-----|-------------|---------|
| `security` | `jwtTtlHours` | Access token TTL in hours. | `24` |
| | `minPasswordLength` | Minimum password length. | `8` |
| | `requirePasswordComplexity` | Enforce uppercase, lowercase, digit, special char. | `false` |
| | `deviceApprovalRequired` | Enforce device approval for API calls. | `false` |
| `payment` | `defaultCurrency` | Currency code used in payments. | `LKR` |
| | `gateways.stripe.enabled` | Enable Stripe integration. | `false` |
| | `gateways.payhere.enabled` | Enable PayHere integration. | `true` |
| `email` | `enabled` | Global toggle for email sending. | `true` |
| `sms` | `enabled` | Global toggle for SMS sending. | `true` |
| `whatsapp` | `enabled` | Global toggle for WhatsApp notifications. | `false` |
| `communicationChannels.zoneAccess` | `sms`/`email`/`whatsapp` per‑event overrides. | Inherits globals if omitted. |

### 3. Runtime Reload
The backend loads `SystemConfig` on each request that needs configuration (e.g., `notificationService.parseChannels`). Changing values in the DB takes effect immediately without a restart.

### 4. Secure Practices
- **Never** store secrets in the repository. Use CI/CD secret stores.
- Use **dotenv** only for local development; production should inject env vars via the hosting platform.
- Rotate JWT secret and payment keys regularly.
- Enable HTTPS and set `secure: true` for cookies in production.

---
*All information extracted from `.env.example`, `backend/src/models/SystemConfig.js`, and related usage in the code.*
