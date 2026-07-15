# ENTRYNEX | Event Access Management System

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-61dafb.svg)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7+-47a248.svg)](https://www.mongodb.com/)

A comprehensive full-stack event access management platform built with modern web technologies for ticketed events, entry control, attendee verification, and organiser operations.

## <img src="https://img.shields.io/badge/-Features-blue.svg" alt="Features"> Features

### Core Functionality
- **Event Lifecycle Management**: Complete event workflow from draft to completion
- **Multi-Role Dashboard System**: Role-based access for admins, organizers, staff, and attendees
- **Real-time Monitoring**: Live dashboards with Socket.IO for real-time updates
- **Advanced Ticketing**: Public/private tickets, inventory management, and secure checkout
- **Photo Verification**: Attendee identity verification with photo upload and approval workflows
- **Entry Control**: QR/RFID scanning, zone access management, and activity logging
- **Direct Bank Transfer Payments**: Comprehensive bank transfer payment management with verification workflows, automatic order confirmation, and audit logging

### Communication & Notifications
- **Multi-channel Notifications**: Email, SMS, and in-app notifications
- **Customizable Templates**: Email and SMS templates for different event workflows
- **Automated Communications**: Welcome emails, ticket confirmations, and verification requests

### Security & Access Control
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Granular permissions for different user types
- **Event Scoping**: Users can only access authorized events and zones

## <img src="https://img.shields.io/badge/-Tech_Stack-orange.svg" alt="Tech Stack"> Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcrypt password hashing
- **Real-time**: Socket.IO
- **File Storage**: AWS S3 compatible storage
- **Email**: Nodemailer with SMTP providers
- **SMS**: Twilio integration

### Frontend
- **Framework**: React 18 with Hooks
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **State Management**: React Context + useState/useEffect
- **HTTP Client**: Axios
- **Real-time**: Socket.IO client
- **UI Components**: Headless UI + Heroicons

### DevOps & Tools
- **Process Management**: PM2 (production)
- **Development**: Nodemon for backend hot reload
- **Build**: Create React App build system
- **Linting**: ESLint
- **Version Control**: Git

## <img src="https://img.shields.io/badge/-Prerequisites-green.svg" alt="Prerequisites"> Prerequisites

- **Node.js**: 18.0 or higher
- **MongoDB**: 7.0+ (Atlas or local installation)
- **npm**: 8.0+ or **yarn**: 1.22+

## <img src="https://img.shields.io/badge/-Quick_Start-blue.svg" alt="Quick Start"> Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd eams

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Configuration

```bash
# Copy environment template
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your configuration:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/entrynex
# Or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/entrynex

# JWT
JWT_SECRET=your-super-secure-jwt-secret-here
JWT_EXPIRE=7d

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@entrynex.com

# SMS Configuration (Optional)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# Payment Gateway (Optional)
PAYHERE_MERCHANT_ID=your-merchant-id
PAYHERE_SECRET=your-secret-key

# File Storage (Optional - AWS S3)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# Development
NODE_ENV=development
PORT=5000
```

### 3. Database Setup

```bash
# Seed the database with sample data
cd backend
npm run seed
```

This creates default users:
- **Main Admin**: `admin@stadium.entrynex.com` / `Admin@Matrix.Reset`
- **Main Organiser**: `organiser@stadium.entrynex.com` / `Organiser@Matrix.Reset`
- **Sub Organiser**: `suborg@stadium.entrynex.com` / `SubOrg@Matrix.Reset`

### 4. Run the Application

```bash
# Terminal 1: Start Backend
cd backend
npm run dev

# Terminal 2: Start Frontend
cd frontend
npm start
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## Localhost vs LAN (development)

- Localhost (default): use when developing on a single machine.
   - Backend: `http://localhost:5000` — run from `backend` with `npm run dev`.
   - Frontend: `http://localhost:3000` — run from `frontend` with `npm start`.

- LAN (access from other devices on same network):
   - In `backend/src/server.js` bind to all interfaces: `server.listen(PORT, '0.0.0.0')`.
   - Set `REACT_APP_API_URL` in `frontend/.env` to `http://<HOST_IP>:5000/api` (replace `<HOST_IP>` with your machine's LAN IPv4).
   - Start frontend so it serves externally (PowerShell example):
      ```powershell
      cd frontend
      $env:HOST="0.0.0.0"
      npm start
      ```
   - If other devices cannot reach the app, allow inbound firewall rules for ports `3000` and `5000` (requires admin).

See `LAN_RUN.md` for a slightly more detailed checklist.

## <img src="https://img.shields.io/badge/-Project_Structure-purple.svg" alt="Project Structure"> Project Structure

```
eams/
├── backend/                          # Backend API server
│   ├── src/
│   │   ├── config/                   # Database and service configuration
│   │   ├── controllers/              # Route handlers
│   │   ├── middleware/               # Express middleware
│   │   ├── models/                   # MongoDB schemas
│   │   ├── routes/                   # API route definitions
│   │   ├── services/                 # Business logic services
│   │   ├── utils/                    # Utility functions
│   │   └── scripts/                  # Database scripts
│   ├── .env.example                  # Environment template
│   └── package.json
├── frontend/                         # React frontend application
│   ├── public/                       # Static assets
│   ├── src/
│   │   ├── api/                      # API client functions
│   │   ├── components/               # Reusable UI components
│   │   ├── context/                  # React context providers
│   │   ├── layouts/                  # Page layout components
│   │   ├── pages/                    # Page components
│   │   └── utils/                    # Frontend utilities
│   └── package.json
├── docs/                             # Documentation
└── README.md
```

## <img src="https://img.shields.io/badge/-API-blue.svg" alt="API"> API Endpoints

### Public Routes
- `GET /api/events` - List public events
- `GET /api/events/:id` - Get event details
- `POST /api/orders` - Create ticket order
- `POST /api/auth/login` - User authentication

### Protected Routes (Admin)
- `GET /api/admin/dashboard` - Admin dashboard data
- `POST /api/admin/events` - Create event
- `PUT /api/admin/events/:id` - Update event
- `GET /api/admin/payments` - Get payment submissions (platform-wide)
- `GET /api/payment-management/admin/*` - Payment management endpoints

### Protected Routes (Organiser)
- `GET /api/organiser/dashboard` - Organiser dashboard
- `POST /api/organiser/tickets` - Create ticket category
- `GET /api/organiser/attendees` - List event attendees
- `GET /api/organiser/payments` - Get payment submissions (event-scoped)
- `GET /api/payment-management/organizer/*` - Payment management endpoints

### Payment Management Routes
- `GET /api/payment-management/organizer/` - Get payment submissions with filtering
- `POST /api/payment-management/organizer/:submissionId/approve` - Approve payment
- `POST /api/payment-management/organizer/:submissionId/reject` - Reject payment
- `POST /api/payment-management/organizer/:submissionId/request-info` - Request more information
- `GET /api/payment-management/admin/` - Platform-wide payment management

## <img src="https://img.shields.io/badge/-Roles-red.svg" alt="Roles"> User Roles & Permissions

| Role | Description | Permissions |
|------|-------------|-------------|
| **Main Admin** | System administrator | Full system access, user management, system settings |
| **Main Organiser** | Event organizer | Event creation, ticket management, team management |
| **Sub Organiser** | Assistant organizer | Limited event management, attendee oversight |
| **Staff** | Entry personnel | Ticket scanning, entry control, zone access |
| **Volunteer** | Support staff | Limited entry control, basic verification |
| **Auditor** | Read-only access | View reports, monitor activity |
| **Buyer** | Ticket purchaser | Order tickets, manage bookings |
| **Attendee** | Event participant | Photo verification, check-in |

## <img src="https://img.shields.io/badge/-Development-gray.svg" alt="Development"> Development

### Available Scripts

#### Backend
```bash
cd backend
npm run dev      # Start development server with hot reload
npm start        # Start production server
npm run seed     # Seed database with sample data
npm run clear    # Clear database
```

#### Frontend
```bash
cd frontend
npm start        # Start development server
npm run build    # Build for production
npm test         # Run tests
```

### Code Quality

The project uses ESLint for code linting. Run linting:

```bash
cd backend && npm run lint
cd frontend && npm run lint
```

## <img src="https://img.shields.io/badge/-Deployment-blue.svg" alt="Deployment"> Deployment

### Production Build

1. **Build Frontend**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Environment Setup**:
   - Set `NODE_ENV=production` in backend `.env`
   - Configure production database URL
   - Set up SMTP and other service credentials

3. **Start Services**:
   ```bash
   # Using PM2 (recommended)
   cd backend
   npm install -g pm2
   pm2 start src/server.js --name "entrynex-api"

   # Or using npm
   npm start
   ```

### Docker Deployment (Optional)

```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## <img src="https://img.shields.io/badge/-Documentation-green.svg" alt="Documentation"> Documentation

Detailed documentation is available in the `docs/` directory:

- [Setup Guide](docs/SETUP_GUIDE.md) - Detailed installation instructions
- [API Documentation](docs/API_REFERENCE.md) - Complete API reference
- [User Guides](docs/) - Role-specific user guides
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions

## <img src="https://img.shields.io/badge/-Contributing-yellow.svg" alt="Contributing"> Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## <img src="https://img.shields.io/badge/-License-white.svg" alt="License"> License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## <img src="https://img.shields.io/badge/-Support-red.svg" alt="Support"> Support

For support and questions:
- Check the [documentation](docs/)
- Open an issue on GitHub
- Contact the development team

---

**<img src="https://img.shields.io/badge/-Built_with_love-pink.svg" alt="Built with love"> for seamless event management**

## Documentation

Start with:

- [Quick Start](docs/QUICK_START.md)
- [Setup Guide](docs/SETUP_GUIDE.md)
- [System Features Summary](docs/SYSTEM_FEATURES_SUMMARY.md)
- [User Dashboard Guide](docs/USER_DASHBOARD_GUIDE.md)
- [Buyer Confirmation Portal Guide](docs/BUYER_CONFIRMATION_PORTAL_GUIDE.md)

## Notes

- Generated folders such as `node_modules`, `build`, `dist`, uploads, logs, and `.env` files are ignored by Git.
- Temporary one-off database/debug scripts should stay outside tracked source files unless they become maintained utilities.
