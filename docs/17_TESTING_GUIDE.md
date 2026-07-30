# 17_TESTING_GUIDE

## Overview
This guide explains how to run the **unit**, **integration**, and **end‑to‑end (E2E)** test suites for the EAMS platform. The project uses **Jest** for backend tests, **Jest + React Testing Library** for the frontend, and **Cypress** for full‑stack UI tests.

---
### 1️⃣ Prerequisites
| Item | Version |
|------|---------|
| Node.js | 18.x (LTS) |
| npm | 9.x |
| MongoDB | Running locally or a test instance (e.g., `mongodb://localhost:27017/eams_test`) |
| Docker (optional) | 24.x – required only if you run the Cypress container |

---
### 2️⃣ Backend Tests (Jest)
Location: `backend/tests/`
```bash
# Install dev dependencies (if not already installed)
cd backend
npm install --save-dev jest supertest mongodb-memory-server
```
Run the suite:
```bash
npm run test   # defined in backend/package.json as "jest --detectOpenHandles"
```
**Key points**
- Tests use **mongodb-memory-server** to spin up an in‑memory MongoDB instance, avoiding any impact on the development database.
- API routes are exercised with **supertest**.
- Coverage report is generated in `backend/coverage/`.

---
### 3️⃣ Frontend Tests (Jest + React Testing Library)
Location: `frontend/src/__tests__/`
```bash
cd ../frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```
Run:
```bash
npm test   # runs "react-scripts test" which invokes Jest in watch mode by default
```
**Typical tests**
- Component rendering & prop validation.
- Interaction tests (clicks, form submissions).
- Mocking of API calls using **msw** (Mock Service Worker).

---
### 4️⃣ End‑to‑End Tests (Cypress)
Location: `frontend/cypress/`
```bash
cd ../frontend
npm install --save-dev cypress
```
Start the dev servers (backend + frontend) in separate terminals, then run:
```bash
npx cypress open   # opens the Cypress UI
# or headless CI mode
npx cypress run
```
**Test flow**
1. **Create user** → register via UI.
2. **Login** → verify JWT is stored.
3. **Create event**, **place order**, **complete payment**.
4. **Assign tickets** and confirm QR code display.
5. Assertions on API responses and UI elements ensure the full stack works.

---
### 5️⃣ Continuous Integration (CI)
If you add a CI pipeline (GitHub Actions, GitLab CI, etc.), include the following steps:
```yaml
- name: Install dependencies
  run: npm ci
- name: Run backend tests
  run: cd backend && npm test
- name: Run frontend tests
  run: cd frontend && npm test -- --ci --coverage
- name: Run Cypress tests
  run: npx cypress run --headless
```
Ensure the CI environment provides a MongoDB service (Docker image `mongo:5`).

---
### 6️⃣ Adding New Tests
1. **Create a new test file** following the naming convention `*.test.js` for backend or `*.test.jsx` for frontend.
2. **Import the module** you want to test.
3. **Write assertions** using Jest’s `expect` API.
4. **Run the suite** locally to confirm passing before committing.

---
*All testing instructions are derived from the project's `package.json` scripts, existing test files, and common best practices for a Node/React stack.*
