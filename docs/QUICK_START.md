# Quick Start Guide

[Icon: Zap] Get the ENTRYNEX platform running in under 5 minutes.

---

## 1. Prerequisites [Icon: Tools]

Before you begin, ensure you have the following installed:
- [Icon: Node] Node.js 18.0 or higher
- [Icon: Database] MongoDB (Local or Atlas)
- [Icon: Package] npm or yarn

---

## 2. Fast Setup [Icon: Rocket]

### Step 1: Install Dependencies
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Step 2: Environment Configuration
1. Go to `backend/` and copy `.env.example` to `.env`.
2. Update `MONGODB_URI` with your connection string.
3. Update **S3 Storage** and **Twilio** credentials (see [SETUP_GUIDE.md](SETUP_GUIDE.md)).

### Step 3: Seed the Database
```bash
cd backend
npm run seed
```
[Icon: Success] This will create the default roles and a sample event in **Draft** mode.

---

## 3. Launch [Icon: Play]

### Terminal 1: Backend
```bash
cd backend
npm run dev
```

### Terminal 2: Frontend
```bash
cd frontend
npm start
```

---

## 4. Testing Your First Event [Icon: Check]

1. **Login as Admin**: Use your seeded admin credentials.
2. **Access Dashboard**: You will see the seeded sample event in your list.
3. **Login as Organiser**: Switch to an organiser account.
4. **Publish**: Go to **Event Customization**, pick a theme color, and click **Publish**.
5. **Verify**: Visit the public homepage to see your live event with its new branding and **Real-Time Seat Availability**.

---

## 5. Troubleshooting [Icon: Help]

- **Database Connection**: Ensure MongoDB is running and the URI in `.env` is correct.
- **Port Conflicts**: Ensure ports 5000 (Backend) and 3000 (Frontend) are free.
- **S3 Uploads**: Verify your AWS credentials have `s3:PutObject` permissions for the configured bucket.

---

## Further Documentation [Icon: Book]

- [System Features Summary](SYSTEM_FEATURES_SUMMARY.md)
- [Payment & Email Setup](SETUP_GUIDE.md)
- [Visual Architecture](VISUAL_ARCHITECTURE_DIAGRAMS.md)
