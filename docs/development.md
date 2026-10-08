# Development & Setup Guide

This guide details local environment prerequisites, installation steps, and instructions for running FamVacay on a developer workstation.

---

## Prerequisites

- **Node.js**: `v20.x` or higher (Active LTS recommended)
- **Package Manager**: `npm` (v10+)
- **Database & Cache**:
  - PostgreSQL 16+
  - Redis 7+
- **Docker & Docker Compose** (Optional for local containerized development)

---

## Local Environment Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/famvacay.git
cd famvacay
```

### 2. Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env
```

Ensure the following variables are configured for local development:
```env
APP_URL=http://localhost:3000
ALLOWED_ORIGINS=localhost:3000
DATABASE_URL=postgresql://famvacay:famvacay_secure_password@localhost:5432/famvacay_db?schema=public
REDIS_URL=redis://localhost:6379
NEXTAUTH_SECRET=development_secret_key_minimum_32_characters_long
NEXTAUTH_URL=http://localhost:3000
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Initialization & Migrations
Generate the Prisma Client and run the database migrations:
```bash
npm run prisma:generate
npm run prisma:migrate
```

---

## Running the Application

### Development Mode
Start the Next.js development server with hot reloading:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Standalone Build
To test the standalone production build locally:
```bash
npm run build
npm run start
```

---

## Running Tests & Quality Checks

```bash
# Execute unit and algorithm tests (Vitest)
npm test

# Run tests with strict coverage verification (>80% required)
npm run test:coverage

# Perform TypeScript type checking
npm run typecheck

# Run end-to-end journey tests (Playwright)
npm run test:e2e
```
