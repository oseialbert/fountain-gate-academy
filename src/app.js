const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const QRCode = require('qrcode');
const OTPAuth = require('otpauth');
const {
  acceptedTotpStep, createTotp, decryptSecret, encryptSecret, hashPassword, validatePassword, verifyPassword
} = require('./security');

const publicDirectory = path.join(__dirname, '..', 'public');
const indexHtml = fs.readFileSync(path.join(publicDirectory, 'index.html'), 'utf8');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validGradeLevel(value) {
  const level = Number(value);
  return Number.isInteger(level) && level >= 1 && level <= 12 ? level : null;
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createApp({ pool, config, sessionStore }) {
  const app = express();
  if (config.nodeEnv === 'production') app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"]
    } },
    referrerPolicy: { policy: 'no-referrer' }
  }));
  app.use(express.json({ limit: '12kb' }));
  app.use(session({
    name: 'keystone.sid', secret: config.sessionSecret, store: sessionStore,
    resave: false, saveUninitialized: false, rolling: true,
    cookie: { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 }
  }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: config.authRateLimit || 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again in 15 minutes.' }
  });
  app.use('/assets', express.static(publicDirectory, {
    index: false, dotfiles: 'deny', fallthrough: false, maxAge: config.nodeEnv === 'production' ? '1h' : 0
  }));

  const mobileDirectory = path.join(__dirname, '..', 'mobile', 'web');
  app.use('/app', helmet({
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"]
    } },
    referrerPolicy: { policy: 'no-referrer' }
  }));
  app.use('/app', express.static(mobileDirectory, {
    index: false, dotfiles: 'deny', maxAge: config.nodeEnv === 'production' ? '1h' : 0
  }));
  app.get('/app', (_req, res) => res.sendFile(path.join(mobileDirectory, 'index.html')));

  function sendPage(page) {
    return (_req, res) => res.type('html').send(indexHtml.replace('<body>', `<body data-page="${page}">`));
  }

  async function currentUser(req) {
    if (!req.session.userId) return null;
    const result = await pool.query('SELECT id, email, role, totp_enabled FROM users WHERE id = $1', [req.session.userId]);
    return result.rows[0] || null;
  }

  async function requireAuth(req, res, next) {
    try {
      const user = await currentUser(req);
      if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
      req.user = user;
      next();
    } catch (error) { next(error); }
  }

  async function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
    next();
  }

  async function requirePageAuth(req, res, next) {
    try {
      const user = await currentUser(req);
      if (!user) return res.redirect('/login');
      req.user = user;
      next();
    } catch (error) { next(error); }
  }

  function requireCsrf(req, res, next) {
    const token = req.get('x-csrf-token') || req.body?._csrf;
    if (!safeEqual(token, req.session.csrfToken)) {
      return res.status(403).json({ error: 'Your session token expired. Refresh the page and try again.' });
    }
    next();
  }

  function validateTotp(secret, email, token, lastStep) {
    const step = acceptedTotpStep(secret, email, token);
    return step !== null && (lastStep === null || lastStep === undefined || step > Number(lastStep)) ? step : null;
  }

  function completeLogin(req, user, res) {
    req.session.regenerate((error) => {
      if (error) return res.status(500).json({ error: 'Unable to start a secure session.' });
      req.session.userId = user.id;
      res.json({ ok: true, user: { email: user.email, role: user.role } });
    });
  }

  app.get('/api/csrf', (req, res) => {
    if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    res.set('Cache-Control', 'no-store').json({ token: req.session.csrfToken });
  });

  app.post('/api/register', authLimiter, requireCsrf, async (req, res, next) => {
    try {
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = req.body.password;
      if (email.length > 254 || !emailPattern.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
      if (!validatePassword(password)) return res.status(400).json({ error: 'Use a password between 12 and 128 characters.' });
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length) return res.status(409).json({ error: 'An account with that email already exists.' });
      const passwordHash = await hashPassword(password, config.passwordPepper);
      try {
        await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2)', [email, passwordHash]);
      } catch (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.' });
        throw error;
      }
      res.status(201).json({ ok: true });
    } catch (error) { next(error); }
  });

  app.post('/api/login', authLimiter, requireCsrf, async (req, res, next) => {
    try {
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body.password === 'string' ? req.body.password : '';
      const result = await pool.query('SELECT id, email, role, password_hash, totp_enabled FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      const valid = user && await verifyPassword(user.password_hash, password, config.passwordPepper);
      if (!valid) return res.status(401).json({ error: 'Email or password is incorrect.' });
      if (user.totp_enabled) {
        return req.session.regenerate((error) => {
          if (error) return res.status(500).json({ error: 'Unable to start a secure session.' });
          req.session.pendingUserId = user.id;
          res.json({ ok: true, requiresTwoFactor: true });
        });
      }
      completeLogin(req, user, res);
    } catch (error) { next(error); }
  });

  app.post('/api/2fa/verify', authLimiter, requireCsrf, async (req, res, next) => {
    try {
      if (!req.session.pendingUserId) return res.status(401).json({ error: 'Sign in before verifying your code.' });
      const result = await pool.query(
        'SELECT id, email, role, totp_secret, totp_last_step FROM users WHERE id = $1 AND totp_enabled = TRUE',
        [req.session.pendingUserId]
      );
      const user = result.rows[0];
      if (!user) return res.status(401).json({ error: 'Two-factor verification is not available.' });
      const secret = decryptSecret(user.totp_secret, config.totpEncryptionKey);
      const step = validateTotp(secret, user.email, req.body.code, user.totp_last_step);
      if (step === null) return res.status(401).json({ error: 'That code is invalid or has already been used.' });
      const updated = await pool.query(
        'UPDATE users SET totp_last_step = $2 WHERE id = $1 AND (totp_last_step IS NULL OR totp_last_step < $2) RETURNING id',
        [user.id, step]
      );
      if (!updated.rowCount) return res.status(401).json({ error: 'That code has already been used.' });
      completeLogin(req, user, res);
    } catch (error) { next(error); }
  });

  app.post('/api/logout', requireCsrf, (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie('keystone.sid', { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'strict' });
      res.json({ ok: true });
    });
  });

  app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user }));

  app.post('/api/2fa/setup', authLimiter, requireAuth, requireCsrf, async (req, res, next) => {
    try {
      if (req.user.totp_enabled) return res.status(409).json({ error: 'Two-factor authentication is already enabled.' });
      const secret = new OTPAuth.Secret({ size: 20 }).base32;
      const totp = createTotp(secret, req.user.email);
      req.session.pendingTotpSecret = encryptSecret(secret, config.totpEncryptionKey);
      const qrCode = await QRCode.toDataURL(totp.toString(), { errorCorrectionLevel: 'M', margin: 1, width: 220 });
      res.set('Cache-Control', 'no-store').json({ qrCode, secret });
    } catch (error) { next(error); }
  });

  app.post('/api/2fa/enable', authLimiter, requireAuth, requireCsrf, async (req, res, next) => {
    try {
      if (!req.session.pendingTotpSecret) return res.status(400).json({ error: 'Start setup before confirming the code.' });
      const secret = decryptSecret(req.session.pendingTotpSecret, config.totpEncryptionKey);
      const step = validateTotp(secret, req.user.email, req.body.code, null);
      if (step === null) return res.status(400).json({ error: 'Enter the current six-digit code from your authenticator.' });
      await pool.query('UPDATE users SET totp_secret = $2, totp_enabled = TRUE, totp_last_step = $3 WHERE id = $1',
        [req.user.id, encryptSecret(secret, config.totpEncryptionKey), step]);
      delete req.session.pendingTotpSecret;
      res.json({ ok: true });
    } catch (error) { next(error); }
  });

  app.post('/api/2fa/disable', authLimiter, requireAuth, requireCsrf, async (req, res, next) => {
    try {
      const result = await pool.query('SELECT password_hash, totp_secret, totp_last_step FROM users WHERE id = $1', [req.user.id]);
      const account = result.rows[0];
      const passwordValid = await verifyPassword(account.password_hash, req.body.password, config.passwordPepper);
      if (!passwordValid) return res.status(401).json({ error: 'Your password is incorrect.' });
      if (!req.user.totp_enabled) return res.status(400).json({ error: 'Two-factor authentication is not enabled.' });
      const secret = decryptSecret(account.totp_secret, config.totpEncryptionKey);
      const step = validateTotp(secret, req.user.email, req.body.code, account.totp_last_step);
      if (step === null) return res.status(401).json({ error: 'That code is invalid or has already been used.' });
      await pool.query('UPDATE users SET totp_secret = NULL, totp_enabled = FALSE, totp_last_step = NULL WHERE id = $1', [req.user.id]);
      res.json({ ok: true });
    } catch (error) { next(error); }
  });

  app.post('/api/password', requireAuth, requireCsrf, async (req, res, next) => {
    try {
      const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      const valid = await verifyPassword(result.rows[0].password_hash, req.body.currentPassword, config.passwordPepper);
      if (!valid) return res.status(401).json({ error: 'Your current password is incorrect.' });
      if (!validatePassword(req.body.newPassword)) return res.status(400).json({ error: 'Use a new password between 12 and 128 characters.' });
      const passwordHash = await hashPassword(req.body.newPassword, config.passwordPepper);
      await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user.id, passwordHash]);
      res.json({ ok: true });
    } catch (error) { next(error); }
  });

  app.get('/api/school/overview', requireAuth, async (_req, res, next) => {
    try {
      const [students, classes, attendance, grades, recent] = await Promise.all([
        pool.query('SELECT COUNT(*) AS count FROM students'),
        pool.query('SELECT COUNT(*) AS count FROM school_classes'),
        pool.query('SELECT COUNT(*) AS count FROM attendance'),
        pool.query('SELECT COUNT(*) AS count FROM grades'),
        pool.query(`SELECT a.attendance_date, a.status, s.first_name, s.last_name, s.student_number
          FROM attendance a JOIN students s ON s.id = a.student_id
          ORDER BY a.attendance_date DESC, s.last_name ASC LIMIT 8`)
      ]);
      res.json({
        counts: {
          students: Number(students.rows[0].count),
          classes: Number(classes.rows[0].count),
          attendance: Number(attendance.rows[0].count),
          grades: Number(grades.rows[0].count)
        },
        recentAttendance: recent.rows
      });
    } catch (error) { next(error); }
  });

  app.get('/api/school/students', requireAuth, async (_req, res, next) => {
    try {
      const result = await pool.query(`SELECT s.id, s.student_number, s.first_name, s.last_name, s.email,
        s.grade_level, s.homeroom_id, c.name AS homeroom
        FROM students s LEFT JOIN school_classes c ON c.id = s.homeroom_id
        ORDER BY s.last_name, s.first_name LIMIT 500`);
      res.json({ students: result.rows });
    } catch (error) { next(error); }
  });

  app.post('/api/school/students', requireAuth, requireAdmin, requireCsrf, async (req, res, next) => {
    try {
      const { studentNumber, firstName, lastName, email = '', gradeLevel, homeroomId = null } = req.body;
      const level = validGradeLevel(gradeLevel);
      const roomId = homeroomId === '' || homeroomId === null ? null : positiveId(homeroomId);
      if (typeof studentNumber !== 'string' || !/^[A-Za-z0-9-]{1,24}$/.test(studentNumber.trim())) {
        return res.status(400).json({ error: 'Student number must use 1 to 24 letters, numbers, or hyphens.' });
      }
      if (typeof firstName !== 'string' || !firstName.trim() || firstName.trim().length > 80
        || typeof lastName !== 'string' || !lastName.trim() || lastName.trim().length > 80) {
        return res.status(400).json({ error: 'Enter a first and last name (up to 80 characters each).' });
      }
      if (email && (typeof email !== 'string' || email.length > 254 || !emailPattern.test(email))) {
        return res.status(400).json({ error: 'Enter a valid email address or leave it blank.' });
      }
      if (!level) return res.status(400).json({ error: 'Grade level must be between 1 and 12.' });
      if (homeroomId && !roomId) return res.status(400).json({ error: 'Choose a valid homeroom.' });
      const result = await pool.query(`INSERT INTO students
        (student_number, first_name, last_name, email, grade_level, homeroom_id)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [studentNumber.trim(), firstName.trim(), lastName.trim(), email.trim().toLowerCase() || null, level, roomId]);
      res.status(201).json({ ok: true, id: result.rows[0].id });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'That student number is already in use.' });
      if (error.code === '23503') return res.status(400).json({ error: 'The selected homeroom does not exist.' });
      next(error);
    }
  });

  app.put('/api/school/students/:id', requireAuth, requireAdmin, requireCsrf, async (req, res, next) => {
    try {
      const id = positiveId(req.params.id);
      const { studentNumber, firstName, lastName, email = '', gradeLevel, homeroomId = null } = req.body;
      const level = validGradeLevel(gradeLevel);
      const roomId = homeroomId === '' || homeroomId === null ? null : positiveId(homeroomId);
      if (!id || typeof studentNumber !== 'string' || !/^[A-Za-z0-9-]{1,24}$/.test(studentNumber.trim())
        || typeof firstName !== 'string' || !firstName.trim() || firstName.trim().length > 80
        || typeof lastName !== 'string' || !lastName.trim() || lastName.trim().length > 80
        || !level || (email && (typeof email !== 'string' || email.length > 254 || !emailPattern.test(email)))
        || (homeroomId && !roomId)) return res.status(400).json({ error: 'Check the student details and try again.' });
      const result = await pool.query(`UPDATE students SET student_number = $2, first_name = $3, last_name = $4,
        email = $5, grade_level = $6, homeroom_id = $7 WHERE id = $1 RETURNING id`,
      [id, studentNumber.trim(), firstName.trim(), lastName.trim(), email.trim().toLowerCase() || null, level, roomId]);
      if (!result.rows.length) return res.status(404).json({ error: 'Student not found.' });
      res.json({ ok: true });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'That student number is already in use.' });
      if (error.code === '23503') return res.status(400).json({ error: 'The selected homeroom does not exist.' });
      next(error);
    }
  });

  app.delete('/api/school/students/:id', requireAuth, requireCsrf, async (req, res, next) => {
    try {
      const id = positiveId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid student.' });
      const result = await pool.query(`DELETE FROM students WHERE id = $1 AND (
        $2 = 'admin' OR (
          NOT EXISTS (SELECT 1 FROM attendance WHERE student_id = $1)
          AND NOT EXISTS (SELECT 1 FROM grades WHERE student_id = $1)
        )
      ) RETURNING id`, [id, req.user.role]);
      if (!result.rows.length) {
        const exists = await pool.query('SELECT id FROM students WHERE id = $1', [id]);
        if (!exists.rows.length) return res.status(404).json({ error: 'Student not found.' });
        return res.status(409).json({ error: 'Students with attendance or grade history can only be deleted by an administrator.' });
      }
      res.json({ ok: true });
    } catch (error) {
      if (error.code === '23503') return res.status(409).json({ error: 'This student has related school records and cannot be deleted by staff.' });
      next(error);
    }
  });

  app.get('/api/school/classes', requireAuth, async (_req, res, next) => {
    try {
      const result = await pool.query(`SELECT c.id, c.name, c.subject, c.grade_level, c.teacher_name, c.room,
        COUNT(s.id) AS student_count FROM school_classes c
        LEFT JOIN students s ON s.homeroom_id = c.id
        GROUP BY c.id ORDER BY c.grade_level, c.name LIMIT 300`);
      res.json({ classes: result.rows });
    } catch (error) { next(error); }
  });

  app.post('/api/school/classes', requireAuth, requireCsrf, async (req, res, next) => {
    try {
      const { name, subject, gradeLevel, teacherName, room = '' } = req.body;
      const level = validGradeLevel(gradeLevel);
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 80
        || typeof subject !== 'string' || !subject.trim() || subject.trim().length > 80
        || typeof teacherName !== 'string' || !teacherName.trim() || teacherName.trim().length > 100
        || typeof room !== 'string' || room.length > 40 || !level) {
        return res.status(400).json({ error: 'Enter a class name, subject, teacher, room, and grade level 1 to 12.' });
      }
      const result = await pool.query(`INSERT INTO school_classes (name, subject, grade_level, teacher_name, room)
        VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name.trim(), subject.trim(), level, teacherName.trim(), room.trim()]);
      res.status(201).json({ ok: true, id: result.rows[0].id });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'That class already exists for this grade.' });
      next(error);
    }
  });

  app.delete('/api/school/classes/:id', requireAuth, requireCsrf, async (req, res, next) => {
    try {
      const id = positiveId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid class.' });
      const result = await pool.query(`DELETE FROM school_classes WHERE id = $1 AND (
        $2 = 'admin' OR (
          NOT EXISTS (SELECT 1 FROM students WHERE homeroom_id = $1)
          AND NOT EXISTS (SELECT 1 FROM grades WHERE class_id = $1)
        )
      ) RETURNING id`, [id, req.user.role]);
      if (!result.rows.length) {
        const exists = await pool.query('SELECT id FROM school_classes WHERE id = $1', [id]);
        if (!exists.rows.length) return res.status(404).json({ error: 'Class not found.' });
        return res.status(409).json({ error: 'Classes with roster or grade records can only be deleted by an administrator.' });
      }
      res.json({ ok: true });
    } catch (error) {
      if (error.code === '23503') return res.status(409).json({ error: 'This class has related school records and cannot be deleted by staff.' });
      next(error);
    }
  });

  app.put('/api/school/roster/:studentId', requireAuth, requireCsrf, async (req, res, next) => {
    try {
      const studentId = positiveId(req.params.studentId);
      const classId = req.body.classId === '' || req.body.classId === null ? null : positiveId(req.body.classId);
      if (!studentId || (req.body.classId && !classId)) return res.status(400).json({ error: 'Choose a valid student and class.' });
      const result = await pool.query('UPDATE students SET homeroom_id = $2 WHERE id = $1 RETURNING id', [studentId, classId]);
      if (!result.rows.length) return res.status(404).json({ error: 'Student not found.' });
      res.json({ ok: true });
    } catch (error) {
      if (error.code === '23503') return res.status(400).json({ error: 'The selected class does not exist.' });
      next(error);
    }
  });

  app.delete('/api/school/roster/:studentId', requireAuth, requireCsrf, async (req, res, next) => {
    try {
      const studentId = positiveId(req.params.studentId);
      if (!studentId) return res.status(400).json({ error: 'Invalid student.' });
      const result = await pool.query('UPDATE students SET homeroom_id = NULL WHERE id = $1 AND homeroom_id IS NOT NULL RETURNING id', [studentId]);
      if (!result.rows.length) return res.status(404).json({ error: 'Roster assignment not found.' });
      res.json({ ok: true });
    } catch (error) { next(error); }
  });

  app.get('/api/school/attendance', requireAuth, async (req, res, next) => {
    try {
      const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10);
      if (!datePattern.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
        return res.status(400).json({ error: 'Use a valid date in YYYY-MM-DD format.' });
      }
      const result = await pool.query(`SELECT s.id AS student_id, s.student_number, s.first_name, s.last_name,
        s.grade_level, a.status, a.note FROM students s LEFT JOIN attendance a
        ON a.student_id = s.id AND a.attendance_date = $1 ORDER BY s.grade_level, s.last_name, s.first_name`, [date]);
      res.json({ date, attendance: result.rows });
    } catch (error) { next(error); }
  });

  app.post('/api/school/attendance/:studentId', requireAuth, requireCsrf, async (req, res, next) => {
    try {
      const studentId = positiveId(req.params.studentId);
      const { date, status, note = '' } = req.body;
      if (!studentId || typeof date !== 'string' || !datePattern.test(date)
        || Number.isNaN(Date.parse(`${date}T00:00:00Z`))
        || !['present', 'absent', 'late', 'excused'].includes(status)
        || typeof note !== 'string' || note.length > 240) {
        return res.status(400).json({ error: 'Check the attendance date, status, and note.' });
      }
      const updated = await pool.query(`UPDATE attendance SET status = $3, note = $4, marked_by = $5
        WHERE student_id = $1 AND attendance_date = $2 RETURNING id`,
      [studentId, date, status, note.trim(), req.user.id]);
      if (!updated.rows.length) {
        await pool.query(`INSERT INTO attendance (student_id, attendance_date, status, note, marked_by)
          VALUES ($1, $2, $3, $4, $5)`, [studentId, date, status, note.trim(), req.user.id]);
      }
      res.json({ ok: true });
    } catch (error) {
      if (error.code === '23503') return res.status(404).json({ error: 'Student not found.' });
      next(error);
    }
  });

  app.delete('/api/school/attendance/:studentId', requireAuth, requireCsrf, async (req, res, next) => {
    try {
      const studentId = positiveId(req.params.studentId);
      const { date } = req.body;
      if (!studentId || typeof date !== 'string' || !datePattern.test(date)
        || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
        return res.status(400).json({ error: 'Choose a valid student and attendance date.' });
      }
      const result = await pool.query('DELETE FROM attendance WHERE student_id = $1 AND attendance_date = $2 RETURNING id', [studentId, date]);
      if (!result.rows.length) return res.status(404).json({ error: 'Attendance record not found.' });
      res.json({ ok: true });
    } catch (error) { next(error); }
  });

  app.get('/api/school/grades', requireAuth, async (_req, res, next) => {
    try {
      const result = await pool.query(`SELECT g.id, g.assessment, g.score, g.max_score, g.grade_date,
        s.student_number, s.first_name, s.last_name, c.name AS class_name, c.subject
        FROM grades g JOIN students s ON s.id = g.student_id JOIN school_classes c ON c.id = g.class_id
        ORDER BY g.grade_date DESC, s.last_name LIMIT 500`);
      res.json({ grades: result.rows });
    } catch (error) { next(error); }
  });

  app.post('/api/school/grades', requireAuth, requireCsrf, async (req, res, next) => {
    try {
      const studentId = positiveId(req.body.studentId);
      const classId = positiveId(req.body.classId);
      const { assessment, score, maxScore, gradeDate } = req.body;
      const numericScore = Number(score);
      const numericMax = Number(maxScore);
      const date = gradeDate || new Date().toISOString().slice(0, 10);
      if (!studentId || !classId || typeof assessment !== 'string' || !assessment.trim() || assessment.trim().length > 100
        || !Number.isFinite(numericScore) || !Number.isFinite(numericMax) || numericScore < 0
        || numericMax <= 0 || numericMax > 999.99 || numericScore > numericMax
        || typeof date !== 'string' || !datePattern.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
        return res.status(400).json({ error: 'Check the student, class, assessment, score, and date.' });
      }
      const result = await pool.query(`INSERT INTO grades (student_id, class_id, assessment, score, max_score, grade_date, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [studentId, classId, assessment.trim(), numericScore, numericMax, date, req.user.id]);
      res.status(201).json({ ok: true, id: result.rows[0].id });
    } catch (error) {
      if (error.code === '23503') return res.status(400).json({ error: 'Choose an existing student and class.' });
      next(error);
    }
  });

  app.delete('/api/school/grades/:id', requireAuth, requireAdmin, requireCsrf, async (req, res, next) => {
    try {
      const id = positiveId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid grade.' });
      const result = await pool.query('DELETE FROM grades WHERE id = $1 RETURNING id', [id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Grade not found.' });
      res.json({ ok: true });
    } catch (error) { next(error); }
  });

  app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      const result = await pool.query('SELECT id, email, role, totp_enabled, created_at FROM users ORDER BY created_at DESC LIMIT 100');
      res.json({ users: result.rows });
    } catch (error) { next(error); }
  });

  app.post('/api/admin/accounts', requireAuth, requireAdmin, requireCsrf, async (req, res, next) => {
    try {
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = req.body.password;
      const role = req.body.role;
      if (email.length > 254 || !emailPattern.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
      if (!validatePassword(password)) return res.status(400).json({ error: 'Use a password between 12 and 128 characters.' });
      if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Choose staff or administrator access.' });
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length) return res.status(409).json({ error: 'An account with that email already exists.' });
      const passwordHash = await hashPassword(password, config.passwordPepper);
      try {
        await pool.query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)', [email, passwordHash, role]);
      } catch (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.' });
        throw error;
      }
      res.status(201).json({ ok: true });
    } catch (error) { next(error); }
  });

  app.get('/', sendPage('home'));
  app.get('/register', sendPage('register'));
  app.get('/login', sendPage('login'));
  app.get('/verify-2fa', (req, res) => req.session.pendingUserId ? sendPage('verify-2fa')(req, res) : res.redirect('/login'));
  app.get('/dashboard', requirePageAuth, sendPage('dashboard'));
  app.get('/students', requirePageAuth, sendPage('students'));
  app.get('/classes', requirePageAuth, sendPage('classes'));
  app.get('/attendance', requirePageAuth, sendPage('attendance'));
  app.get('/grades', requirePageAuth, sendPage('grades'));
  app.get('/security', requirePageAuth, sendPage('security'));
  app.get('/change-password', requirePageAuth, sendPage('change-password'));
  app.get('/admin', requirePageAuth, (req, res) => req.user.role === 'admin' ? sendPage('admin')(req, res) : res.redirect('/dashboard'));

  app.use((error, _req, res, _next) => {
    if (res.headersSent) return;
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  return app;
}

module.exports = { createApp };