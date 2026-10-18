# Fountain Gate Academy school portal

A vanilla JavaScript, Express, and PostgreSQL school management portal. It includes student records, class rosters, attendance, a gradebook, school overview metrics, and secure registration/login with optional authenticator-based two-factor verification.

## Requirements

- Node.js 20 or later
- PostgreSQL 14 or later

This workspace's portable PostgreSQL 17 cluster is stored under `%LOCALAPPDATA%\Keystone` and is not registered as a Windows service. After a Windows restart, start it from PowerShell with:

```powershell
$pgBin = Join-Path $env:LOCALAPPDATA 'Keystone\PostgreSQL17\pgsql\bin'
$pgData = Join-Path $env:LOCALAPPDATA 'Keystone\PGDATA'
$pgLog = Join-Path $env:LOCALAPPDATA 'Keystone\postgres.log'
& (Join-Path $pgBin 'pg_ctl.exe') -D $pgData -l $pgLog -o '-h 127.0.0.1 -p 5432' -w start
```

Stop it cleanly with:

```powershell
& (Join-Path $pgBin 'pg_ctl.exe') -D $pgData -m fast -w stop
```

## Local setup

1. Create a PostgreSQL database named `keystone_auth` and a database user with permission to create tables.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to your local connection string.
3. Generate three independent secrets and put them in `.env`:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Use the first value for `SESSION_SECRET`, the second for `PASSWORD_PEPPER`, and the third for `TOTP_ENCRYPTION_KEY`. Keep `.env` private and back up the encryption key securely; losing it makes enrolled authenticator secrets unrecoverable.
4. Install packages and create tables:

   ```powershell
   npm install
   npm run db:init
   ```

5. Start the app with `npm start` and open `http://localhost:3000`.

For production, set `NODE_ENV=production`, use HTTPS, set `DATABASE_SSL=true` when required by your PostgreSQL host, and use a managed PostgreSQL service. Cookies are marked Secure in production. Do not expose `.env` or the pepper/encryption key to browser code.

## Deploy to Render

The root `render.yaml` is a Render Blueprint for the Express web service and PostgreSQL database. It uses Render-generated values for the session secret, password pepper, and TOTP encryption key; no local `.env` values are uploaded.

1. Push this project to a GitHub repository. Keep `.env` private; it is excluded by `.gitignore`.
2. In the Render Dashboard, choose **New > Blueprint** and connect the repository containing `render.yaml`.
3. Review the resources and select **Apply**. The Blueprint uses free plans to avoid unexpected charges.
4. Wait for the first deploy, then open the service's `onrender.com` URL.
5. Register a staff account and promote the trusted initial admin in the Render database using the SQL in [Administrator access](#administrator-access).

The free Render web service spins down after 15 minutes without traffic and can take about a minute to wake. More importantly, a free Render Postgres database expires 30 days after creation; Render deletes it after an additional 14-day grace period if it is not upgraded. Upgrade the database before storing real school data, and choose a paid web-service plan if you need it to stay continuously available. Check Render's current plan terms before deployment.

## Administrator access

New accounts always receive the `user` role. After registering the trusted account, promote it using a PostgreSQL administrator connection:

```sql
UPDATE users SET role = 'admin' WHERE email = 'trusted@example.com';
```

The database constraint permits exactly `user` and `admin`; the public staff registration endpoint does not accept a role. Admins can create accounts, manage student records, and delete classes or grade records. Staff accounts use the `user` role and can create classes, manage homeroom roster assignments, record attendance, and add grades. Both roles can view school records; student creation and grade deletion remain admin-only. APIs enforce these permissions server-side.

## School workspace

- `/dashboard` shows student, class, attendance, and assessment totals plus recent attendance.
- `/students` supports adding, editing, and removing students, including grade level and homeroom.
- `/classes` lets staff manage class, subject, teacher, room, grade-level, and homeroom roster assignments.
- `/attendance` lets staff record daily present, absent, late, or excused status with an optional note.
- `/grades` lets staff record assessment scores; only admins can remove grade records.
- `/admin` lets administrators create separate staff/teacher or administrator accounts.

Delete actions ask for confirmation. Staff and admins can delete attendance records and remove students from class rosters. Staff can delete students only when they have no attendance or grade history, and classes only when they have no roster or grades. Admins can delete students or classes with related history; deleting a student cascades attendance and grades, while deleting a class cascades grades and clears homeroom assignments. Grade deletion is admin-only.

## Security notes

- Passwords are hashed with Argon2id, a per-password random salt, and a server-only pepper.
- TOTP secrets are encrypted at rest with AES-256-GCM and a separate 32-byte key. The temporary setup secret in the server-side session is encrypted too.
- Sessions use PostgreSQL in the running app, HttpOnly/SameSite cookies, session ID rotation at authentication, and an eight-hour idle lifetime.
- State-changing requests require a session-bound CSRF token. Authentication endpoints are rate-limited.
- The app validates email/password inputs, uses parameterized SQL, and exposes no public role assignment.
- Use HTTPS in production. Rate-limit storage is in-process; deploy a shared rate-limit store when running multiple instances.

## Tests

Run `npm test`. The integration suite uses `pg-mem` and Supertest, so it does not need a local PostgreSQL service. It covers CSRF, registration, password hashing, login, encrypted TOTP setup and verification, OTP replay rejection, role authorization, password changes, school record management, attendance, grades, and authenticated encryption.

## Routes

- `/` Home
- `/register`, `/login`, `/verify-2fa`
- `/dashboard`, `/students`, `/classes`, `/attendance`, `/grades`
- `/admin`, `/security`, `/change-password`
- `/api/*` JSON endpoints used by the frontend

Protected pages redirect unauthenticated users, and their backing APIs independently enforce session and role authorization.