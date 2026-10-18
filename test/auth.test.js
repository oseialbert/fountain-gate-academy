const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { newDb } = require('pg-mem');
const request = require('supertest');
const OTPAuth = require('otpauth');
const { createApp } = require('../src/app');
const { readConfig } = require('../src/config');
const { decryptSecret, encryptSecret } = require('../src/security');

let pool;
let app;
let client;
let config;

before(async () => {
  const database = newDb();
  const adapter = database.adapters.createPg();
  pool = new adapter.Pool();
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);
  config = {
    ...readConfig({
    DATABASE_URL: 'postgres://test', SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
    PASSWORD_PEPPER: crypto.randomBytes(32).toString('hex'), TOTP_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
    NODE_ENV: 'test'
    }),
    authRateLimit: 100
  };
  app = createApp({ pool, config });
  client = request.agent(app);
});

after(async () => pool.end());

async function post(url, body) {
  const csrfResponse = await client.get('/api/csrf');
  return client.post(url).set('X-CSRF-Token', csrfResponse.body.token).send(body);
}

async function postWithCsrf(agent, url, body) {
  const csrfResponse = await agent.get('/api/csrf');
  return agent.post(url).set('X-CSRF-Token', csrfResponse.body.token).send(body);
}

async function putWithCsrf(agent, url, body) {
  const csrfResponse = await agent.get('/api/csrf');
  return agent.put(url).set('X-CSRF-Token', csrfResponse.body.token).send(body);
}

async function deleteWithCsrf(agent, url, body = {}) {
  const csrfResponse = await agent.get('/api/csrf');
  return agent.delete(url).set('X-CSRF-Token', csrfResponse.body.token).send(body);
}

test('CSRF is required and registration creates only a user role', async () => {
  const rejected = await client.post('/api/register').send({ email: 'learner@example.test', password: 'A strong password 123!' });
  assert.equal(rejected.status, 403);
  const created = await post('/api/register', { email: 'Learner@example.test', password: 'A strong password 123!', role: 'admin' });
  assert.equal(created.status, 201);
  const stored = await pool.query('SELECT email, role, password_hash FROM users');
  assert.equal(stored.rows[0].email, 'learner@example.test');
  assert.equal(stored.rows[0].role, 'user');
  assert.notEqual(stored.rows[0].password_hash, 'A strong password 123!');
  const duplicate = await post('/api/register', { email: 'learner@example.test', password: 'A strong password 123!' });
  assert.equal(duplicate.status, 409);
});

test('login, encrypted authenticator setup, code verification, and replay rejection work', async () => {
  const loggedIn = await post('/api/login', { email: 'learner@example.test', password: 'A strong password 123!' });
  assert.equal(loggedIn.status, 200);
  assert.equal(loggedIn.body.user.role, 'user');
  assert.equal((await client.get('/api/me')).status, 200);
  const setup = await post('/api/2fa/setup', {});
  assert.equal(setup.status, 200);
  assert.match(setup.body.qrCode, /^data:image\/png;base64,/);
  const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(setup.body.secret) }).generate();
  assert.equal((await post('/api/2fa/enable', { code })).status, 200);
  const saved = await pool.query('SELECT totp_secret, totp_enabled FROM users WHERE email = $1', ['learner@example.test']);
  assert.equal(saved.rows[0].totp_enabled, true);
  assert.notEqual(saved.rows[0].totp_secret, setup.body.secret);
  assert.equal(decryptSecret(saved.rows[0].totp_secret, config.totpEncryptionKey), setup.body.secret);
  await post('/api/logout', {});
  const secondLogin = await post('/api/login', { email: 'learner@example.test', password: 'A strong password 123!' });
  assert.equal(secondLogin.body.requiresTwoFactor, true);
  assert.equal((await post('/api/2fa/verify', { code })).status, 401);
  const laterCode = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(setup.body.secret) }).generate({ timestamp: Date.now() + 30000 });
  assert.equal((await post('/api/2fa/verify', { code: laterCode })).status, 200);
  assert.equal((await client.get('/api/me')).status, 200);
});

test('user role cannot access admin routes; password change takes effect', async () => {
  assert.equal((await client.get('/api/admin/users')).status, 403);
  const changed = await post('/api/password', { currentPassword: 'A strong password 123!', newPassword: 'An even stronger password 456!' });
  assert.equal(changed.status, 200);
  await post('/api/logout', {});
  assert.equal((await post('/api/login', { email: 'learner@example.test', password: 'A strong password 123!' })).status, 401);
  assert.equal((await post('/api/login', { email: 'learner@example.test', password: 'An even stronger password 456!' })).status, 200);
});

test('public pages render, private pages redirect, and a promoted admin can view accounts', async () => {
  const guest = request.agent(app);
  for (const [url, pageName] of [['/', 'home'], ['/register', 'register'], ['/login', 'login']]) {
    const response = await guest.get(url);
    assert.equal(response.status, 200);
    assert.match(response.text, new RegExp(`data-page="${pageName}"`));
  }
  for (const url of ['/dashboard', '/security', '/change-password', '/admin']) {
    const response = await guest.get(url);
    assert.equal(response.status, 302);
    assert.equal(response.headers.location, '/login');
  }

  const adminApp = createApp({ pool, config });
  const admin = request.agent(adminApp);
  let csrf = (await admin.get('/api/csrf')).body.token;
  const registered = await admin.post('/api/register').set('X-CSRF-Token', csrf)
    .send({ email: 'admin@example.test', password: 'A separate strong password!' });
  assert.equal(registered.status, 201);
  await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", ['admin@example.test']);
  csrf = (await admin.get('/api/csrf')).body.token;
  const signedIn = await admin.post('/api/login').set('X-CSRF-Token', csrf)
    .send({ email: 'admin@example.test', password: 'A separate strong password!' });
  assert.equal(signedIn.status, 200);
  assert.equal((await admin.get('/admin')).status, 200);
  const accountList = await admin.get('/api/admin/users');
  assert.equal(accountList.status, 200);
  assert.ok(accountList.body.users.some((user) => user.email === 'admin@example.test' && user.role === 'admin'));
});

test('staff and admins have scoped school write and delete permissions', async () => {
  const schoolAdmin = request.agent(createApp({ pool, config }));
  const registered = await postWithCsrf(schoolAdmin, '/api/register', {
    email: 'school-admin@example.test', password: 'A separate school password 123!'
  });
  assert.equal(registered.status, 201);
  await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", ['school-admin@example.test']);
  const signedIn = await postWithCsrf(schoolAdmin, '/api/login', {
    email: 'school-admin@example.test', password: 'A separate school password 123!'
  });
  assert.equal(signedIn.status, 200);
  const provisioned = await postWithCsrf(schoolAdmin, '/api/admin/accounts', {
    email: 'created-staff@example.test', password: 'A staff onboarding password 123!', role: 'user'
  });
  assert.equal(provisioned.status, 201);
  const provisionedRow = await pool.query('SELECT role, password_hash FROM users WHERE email = $1', ['created-staff@example.test']);
  assert.equal(provisionedRow.rows[0].role, 'user');
  assert.notEqual(provisionedRow.rows[0].password_hash, 'A staff onboarding password 123!');

  const createdClass = await postWithCsrf(schoolAdmin, '/api/school/classes', {
    name: 'Room 4A', subject: 'Homeroom', gradeLevel: 4, teacherName: 'Taylor Reed', room: 'A-104'
  });
  assert.equal(createdClass.status, 201);
  const classId = createdClass.body.id;
  const createdStudent = await postWithCsrf(schoolAdmin, '/api/school/students', {
    studentNumber: 'STU-4001', firstName: 'Jordan', lastName: 'Lee',
    email: 'jordan@example.test', gradeLevel: 4, homeroomId: classId
  });
  assert.equal(createdStudent.status, 201);
  const studentId = createdStudent.body.id;

  const updatedStudent = await putWithCsrf(schoolAdmin, `/api/school/students/${studentId}`, {
    studentNumber: 'STU-4001', firstName: 'Jordan', lastName: 'Morgan',
    email: 'jordan@example.test', gradeLevel: 4, homeroomId: classId
  });
  assert.equal(updatedStudent.status, 200);

  const attendance = await postWithCsrf(schoolAdmin, `/api/school/attendance/${studentId}`, {
    date: '2026-10-17', status: 'late', note: 'Bus delay'
  });
  assert.equal(attendance.status, 200);
  const attendanceList = await schoolAdmin.get('/api/school/attendance?date=2026-10-17');
  assert.equal(attendanceList.body.attendance[0].status, 'late');
  assert.equal(attendanceList.body.attendance[0].note, 'Bus delay');

  const grade = await postWithCsrf(schoolAdmin, '/api/school/grades', {
    studentId, classId, assessment: 'Reading check', score: 9.5, maxScore: 10, gradeDate: '2026-10-17'
  });
  assert.equal(grade.status, 201);
  const overview = await schoolAdmin.get('/api/school/overview');
  assert.ok(overview.body.counts.students >= 1);
  assert.ok(overview.body.counts.classes >= 1);
  assert.ok(overview.body.counts.attendance >= 1);
  assert.ok(overview.body.counts.grades >= 1);

  const schoolUser = request.agent(createApp({ pool, config }));
  assert.equal((await postWithCsrf(schoolUser, '/api/register', {
    email: 'school-user@example.test', password: 'A separate user password 123!'
  })).status, 201);
  assert.equal((await postWithCsrf(schoolUser, '/api/login', {
    email: 'school-user@example.test', password: 'A separate user password 123!'
  })).status, 200);
  assert.equal((await schoolUser.get('/api/school/students')).status, 200);
  const staffClass = await postWithCsrf(schoolUser, '/api/school/classes', {
    name: 'Language Lab', subject: 'Languages', gradeLevel: 4, teacherName: 'Jordan Park', room: 'B-201'
  });
  assert.equal(staffClass.status, 201);
  assert.equal((await putWithCsrf(schoolUser, `/api/school/roster/${studentId}`, { classId: staffClass.body.id })).status, 200);
  assert.equal((await postWithCsrf(schoolUser, `/api/school/attendance/${studentId}`, {
    date: '2026-10-17', status: 'present', note: ''
  })).status, 200);
  const staffGrade = await postWithCsrf(schoolUser, '/api/school/grades', {
    studentId, classId, assessment: 'Staff-entered check', score: 8.5, maxScore: 10, gradeDate: '2026-10-17'
  });
  assert.equal(staffGrade.status, 201);
  assert.equal((await deleteWithCsrf(schoolUser, `/api/school/grades/${staffGrade.body.id}`)).status, 403);
  assert.equal((await deleteWithCsrf(schoolUser, `/api/school/students/${studentId}`)).status, 409);
  assert.equal((await deleteWithCsrf(schoolUser, `/api/school/classes/${classId}`)).status, 409);
  assert.equal((await deleteWithCsrf(schoolUser, `/api/school/attendance/${studentId}`, { date: '2026-10-17' })).status, 200);
  assert.equal((await deleteWithCsrf(schoolUser, `/api/school/roster/${studentId}`)).status, 200);
  const unassignedStudent = await pool.query('SELECT homeroom_id FROM students WHERE id = $1', [studentId]);
  assert.equal(unassignedStudent.rows[0].homeroom_id, null);

  const orphanStudent = await postWithCsrf(schoolAdmin, '/api/school/students', {
    studentNumber: 'STU-4003', firstName: 'Robin', lastName: 'Vale', gradeLevel: 4
  });
  assert.equal(orphanStudent.status, 201);
  assert.equal((await deleteWithCsrf(schoolUser, `/api/school/students/${orphanStudent.body.id}`)).status, 200);
  assert.equal((await deleteWithCsrf(schoolUser, `/api/school/classes/${staffClass.body.id}`)).status, 200);
  assert.equal((await deleteWithCsrf(schoolAdmin, `/api/school/students/${studentId}`)).status, 200);
  assert.equal((await deleteWithCsrf(schoolAdmin, `/api/school/classes/${classId}`)).status, 200);

  const schoolUserCsrf = (await schoolUser.get('/api/csrf')).body.token;
  const forbidden = await schoolUser.post('/api/school/students').set('X-CSRF-Token', schoolUserCsrf).send({
    studentNumber: 'STU-4002', firstName: 'Avery', lastName: 'Park', gradeLevel: 4
  });
  assert.equal(forbidden.status, 403);
  assert.equal((await schoolUser.post('/api/admin/accounts').set('X-CSRF-Token', schoolUserCsrf).send({
    email: 'unauthorized-admin@example.test', password: 'A new admin password 123!', role: 'admin'
  })).status, 403);
});

test('authentication endpoints rate-limit repeated attempts', async () => {
  const limitedApp = createApp({ pool, config: { ...config, authRateLimit: 2 } });
  const limitedClient = request.agent(limitedApp);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = (await limitedClient.get('/api/csrf')).body.token;
    const response = await limitedClient.post('/api/login').set('X-CSRF-Token', token)
      .send({ email: 'nobody@example.test', password: 'not a valid account' });
    assert.equal(response.status, 401);
  }
  const token = (await limitedClient.get('/api/csrf')).body.token;
  const blocked = await limitedClient.post('/api/login').set('X-CSRF-Token', token)
    .send({ email: 'nobody@example.test', password: 'not a valid account' });
  assert.equal(blocked.status, 429);
});

test('secret encryption uses authenticated encryption', () => {
  const key = crypto.randomBytes(32);
  const encrypted = encryptSecret('authenticator-secret', key);
  assert.equal(decryptSecret(encrypted, key), 'authenticator-secret');
  assert.throws(() => decryptSecret(encrypted, crypto.randomBytes(32)));
});