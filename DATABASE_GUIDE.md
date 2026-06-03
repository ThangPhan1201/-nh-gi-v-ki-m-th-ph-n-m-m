# Database Integration Guide

## Overview

This project now supports PostgreSQL database integration for the Booking Clinic system. You can connect to your existing `booking_db` database and use it for automated testing.

## Database Configuration

### 1. Configure Database Connection

Edit `src/config/database.json`:

```json
{
  "host": "localhost",
  "port": 5432,
  "database": "booking_db",
  "username": "postgres",
  "password": "YOUR_PASSWORD",
  "ssl": false
}
```

Or use environment variables (copy `.env.example` to `.env`):

```bash
cp .env.example .env
# Edit .env with your actual database password
```

## CLI Commands

### Check Database Connection

```bash
npm run start -- db:status
```

Output:
```
╔══════════════════════════════════════════════════════════════╗
║              DATABASE STATUS: CONNECTED                     ║
╚══════════════════════════════════════════════════════════════╝
  PostgreSQL Version: PostgreSQL 18.1...

  Statistics:
    Users        : 20
    Patients     : 11
    Doctors      : 4
    Appointments : 75
    Departments  : 18
```

### List Users

```bash
npm run start -- db:users
npm run start -- db:users --role patient
npm run start -- db:users --role doctor
npm run start -- db:users --role admin
```

### List Patients

```bash
npm run start -- db:patients
```

### List Doctors

```bash
npm run start -- db:doctors
npm run start -- db:doctors --dept 1
```

### List Departments

```bash
npm run start -- db:departments
```

### List Appointments

```bash
npm run start -- db:appointments
npm run start -- db:appointments --patient 2321033167
npm run start -- db:appointments --doctor 7
npm run start -- db:appointments --status pending
```

## Test User Management

### Create Test User

```bash
# Create default test user (patient)
npm run start -- db:create-test-user

# Create custom test user
npm run start -- db:create-test-user --email test@example.com --password MyPass123 --role doctor
```

Test users have **plain text passwords** for easy automation login.

### Delete Test User

```bash
npm run start -- db:delete-test-user automation@test.com
```

### Setup Multiple Test Users (Script)

```bash
npx ts-node src/scripts/setupTestUser.ts
```

This creates:
- `automation.patient@test.com` / `TestPassword123`
- `automation.doctor@test.com` / `TestPassword123`
- `automation.admin@test.com` / `TestPassword123`

### List Test Users

```bash
npx ts-node src/scripts/setupTestUser.ts --list
```

### Cleanup Test Users

```bash
npx ts-node src/scripts/setupTestUser.ts --cleanup
```

## Export Credentials

Export user credentials for automation:

```bash
npm run start -- db:export-creds
npm run start -- db:export-creds --role patient --format json
npm run start -- db:export-creds --role doctor --format env
```

## Using in Test Code

```typescript
import { DatabaseConnector } from './src/core/DatabaseConnector';

async function runTest() {
  const db = DatabaseConnector.fromConfigFile();
  await db.connect();

  // Get test credentials
  const users = await db.getCredentials({
    role: 'patient',
    isActive: true,
    limit: 1
  });

  if (users.length > 0) {
    const user = users[0];
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
  }

  // Get patient info
  const patient = await db.getPatientByUserId(user.userId);
  console.log(`Patient Name: ${patient?.fullName}`);

  await db.disconnect();
}
```

## Important Notes

### Password Hashing

The database uses **bcrypt** for password hashing:

```
$2b$10$U1MVoccQRatFXHnZTXC7/OzDDOzQGZh1QiGJn5fcxuKDbCDK8uX..
```

This means:
- **Cannot decrypt** passwords directly
- Use the **login API** for authentication in tests
- Or create **test users with plain text passwords**

### Recommended Approach

For automation testing:

1. **Create test users** with plain text passwords
2. **Login via API** instead of form (if available)
3. **Store session/token** for authenticated requests

Example API login:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"automation.patient@test.com","password":"TestPassword123"}'
```

## Database Schema

| Table | Description |
|-------|-------------|
| `users` | User accounts with bcrypt hashed passwords |
| `patients` | Patient profile information |
| `doctors` | Doctor profile information |
| `departments` | Hospital departments |
| `appointments` | Appointment records |
| `medical_records` | Medical records |
| `prescriptions` | Prescription details |
| `notifications` | User notifications |

## Troubleshooting

### Connection Failed

```
Error: Connection refused
```

**Solutions:**
1. Ensure PostgreSQL is running
2. Check host/port in config
3. Verify username/password

### Authentication Failed

```
Error: password authentication failed
```

**Solutions:**
1. Check password in `database.json`
2. Verify PostgreSQL user permissions

### Database Not Found

```
Error: database "booking_db" does not exist
```

**Solutions:**
1. Create the database: `createdb booking_db`
2. Or import from SQL dump: `psql -U postgres booking_db < booking_db.sql`
