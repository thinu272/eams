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
3. (Optional) Update SMTP and PayHere credentials (see [SETUP_GUIDE.md](SETUP_GUIDE.md)).

### Step 3: Seed the Database
```bash
cd backend
npm run seed
```
[Icon: Success] This will create the default roles and a sample "Big Match" event in **Draft** mode.

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

1. **Login as Admin**: Use `admin@stadium.entrynex.com` / `Admin@Matrix.Reset`.
2. **Access Dashboard**: You will see the seeded "The Big Match 2025" in your events list.
3. **Login as Organiser**: Use `organiser@stadium.entrynex.com` / `Organiser@Matrix.Reset`.
4. **Publish**: Go to **Event Customization**, pick a theme color, and click **Publish Match**.
5. **Verify**: Visit the public homepage to see your live event with its new branding.

---

## 5. Troubleshooting [Icon: Help]

- **Database Connection**: Ensure MongoDB is running and the URI in `.env` is correct.
- **Port Conflicts**: Ensure ports 5000 (Backend) and 3000 (Frontend) are free.
- **Image Uploads**: Check that the `backend/uploads` directory exists and has write permissions.

---

## Further Documentation [Icon: Book]

- [System Features Summary](SYSTEM_FEATURES_SUMMARY.md)
- [Payment & Email Setup](SETUP_GUIDE.md)
- [Visual Architecture](VISUAL_ARCHITECTURE_DIAGRAMS.md)
