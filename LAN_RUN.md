Localhost and LAN Run Instructions

1) Localhost (development only)

- Backend (from `backend` folder):
```powershell
cd backend
npm install
npm start
```
- Frontend (from `frontend` folder):
```powershell
cd frontend
# For PowerShell (sets env var for this session):
$env:HOST="127.0.0.1"
npm install
npm start
```
- Open: http://localhost:3000 (frontend) and http://localhost:5000/ (backend health)

2) Local network (access from other devices on same Wi‑Fi)

- Determine your Wi‑Fi IPv4 address (on Windows):
```powershell
ipconfig
```
- Set `REACT_APP_API_URL` in `frontend/.env` to `http://<YOUR_IP>:5000/api` (replace `<YOUR_IP>` with the Wi‑Fi IPv4)
- Start backend bound to all interfaces (for LAN testing): ensure `server.listen(PORT, '0.0.0.0')` in `backend/src/server.js` and start:
```powershell
cd backend
npm start
```
- Start frontend (serve on all interfaces):
```powershell
cd frontend
# For PowerShell:
$env:HOST="0.0.0.0"
npm start
```
- If other devices cannot reach the app, allow inbound firewall rules for ports 3000 and 5000 (requires admin):
```powershell
# Run PowerShell as Administrator
New-NetFirewallRule -DisplayName "EAMS Backend 5000" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow -Profile Private -Enabled True
New-NetFirewallRule -DisplayName "EAMS Frontend 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private -Enabled True
```

3) Notes
- Keep your MongoDB Atlas IP whitelist and other credentials unchanged.
- Use `REACT_APP_API_URL` to toggle backend target without touching code.
- Revert `backend/src/server.js` to `127.0.0.1` and `frontend/.env` to `http://localhost:5000/api` to restrict to localhost again.
