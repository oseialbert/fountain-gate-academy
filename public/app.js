const appRoot = document.querySelector('#app');
const navigation = document.querySelector('#navigation');
const page = document.body.dataset.page;
let studentsCache = [];
let classesCache = [];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (options.method && options.method !== 'GET') {
    const csrfResponse = await fetch('/api/csrf', { credentials: 'same-origin' });
    const csrf = await csrfResponse.json();
    headers['X-CSRF-Token'] = csrf.token;
  }
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The request could not be completed.');
  return body;
}

function showMessage(message, type = 'success') {
  const target = document.querySelector('[data-message]');
  if (!target) return;
  target.textContent = message;
  target.className = `notice notice-${type}`;
  target.hidden = false;
}

function formField(label, name, type, options = {}) {
  const input = `<input name="${name}" type="${type}" ${options.autocomplete ? `autocomplete="${options.autocomplete}"` : ''} ${options.inputmode ? `inputmode="${options.inputmode}"` : ''} ${options.maxlength ? `maxlength="${options.maxlength}"` : ''} ${options.min !== undefined ? `min="${options.min}"` : ''} ${options.max !== undefined ? `max="${options.max}"` : ''} ${options.step ? `step="${options.step}"` : ''} ${options.required === false ? '' : 'required'} ${options.minlength ? `minlength="${options.minlength}"` : ''}>`;
  const control = type === 'password'
    ? `<span class="input-with-action">${input}<button class="password-toggle" type="button" data-action="toggle-password" aria-label="Show password" aria-pressed="false">Show</button></span>`
    : input;
  return `<label class="field"><span>${label}</span>${control}</label>`;
}

function shell(eyebrow, heading, description, content) {
  appRoot.innerHTML = `<a class="page-back" href="/">← Back to Fountain Gate Academy</a><div class="content-grid"><section class="intro-panel"><p class="eyebrow">${eyebrow}</p><h1>${heading}</h1><p class="lede">${description}</p><div class="intro-rule"><span></span><span></span><span></span></div><p class="microcopy">A calmer, more deliberate way to protect your account.</p></section><section class="work-panel">${content}</section></div>`;
}

function formCard(title, subtitle, fields, submitLabel, formName) {
  return `<div class="form-heading"><p class="eyebrow">YOUR ACCOUNT</p><h2>${title}</h2><p>${subtitle}</p></div><div class="notice" data-message role="status" hidden></div><form data-form="${formName}" novalidate>${fields}<button class="button button-primary" type="submit">${submitLabel}<span aria-hidden="true">↗</span></button></form>`;
}

function setNavigation(user = null) {
  if (['dashboard', 'students', 'classes', 'attendance', 'grades', 'security', 'change-password', 'admin'].includes(page)) {
    navigation.innerHTML = `<a href="/dashboard">Overview</a><a href="/students">Students</a><a href="/classes">Classes</a><a href="/attendance">Attendance</a><a href="/grades">Grades</a><a href="/security" aria-label="Security settings">Security</a><a href="/change-password">Change password</a>${user?.role === 'admin' ? '<a href="/admin">Admin</a>' : ''}<button class="nav-button" data-action="logout" type="button">Sign out</button>`;
  } else if (page === 'verify-2fa') {
    navigation.innerHTML = '<a href="/login">Cancel</a>';
  } else {
    navigation.innerHTML = '<a href="/login">Sign in</a><a class="nav-cta" href="/register">Staff registration</a>';
  }
}

function renderHome() {
  setNavigation();
  appRoot.innerHTML = `<section class="home-panel school-home"><div class="home-copy"><p class="eyebrow">FOUNTAIN GATE ACADEMY · SCHOOL PORTAL</p><h1>A clearer view of <em>every school day.</em></h1><p class="lede">One secure place for student records, class rosters, attendance, and grades.</p><div class="home-actions"><a class="button button-primary" href="/login">Open school portal <span aria-hidden="true">↗</span></a><a class="text-link" href="/register">Create staff account</a></div></div><div class="school-art" aria-hidden="true"><div class="school-art-board"><span class="board-label">TODAY AT A GLANCE</span><span class="board-number">01</span><span class="board-line"></span><span class="board-line short"></span><span class="board-stamp">F</span></div><span class="school-art-note">LEARN<br>TOGETHER</span></div><div class="home-bottom"><span>STUDENT RECORDS</span><span>ATTENDANCE</span><span>ACADEMIC PROGRESS</span></div></section>`;
}

function schoolPage(eyebrow, title, description, content) {
  const backHref = page === 'dashboard' ? '/' : '/dashboard';
  const backLabel = page === 'dashboard' ? 'Back to school home' : 'Back to overview';
  appRoot.innerHTML = `<div class="school-page"><a class="page-back" href="${backHref}">← ${backLabel}</a><header class="school-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div><span class="school-term">2026 / 27 <span>ACADEMIC YEAR</span></span></header><div class="notice" data-message role="status" hidden></div>${content}</div>`;
}

function selectField(label, name, options, value = '', required = true) {
  return `<label class="field"><span>${label}</span><select name="${name}" ${required ? 'required' : ''}>${options.map((option) => `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
}

function gradeOptions(selected = '') {
  return [{ value: '', label: 'Choose grade' }, ...Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `Grade ${index + 1}` }))];
}

function renderRegister() {
  setNavigation();
  shell('STAFF / TEACHER ACCOUNT', 'Welcome to the staff portal.', 'Staff and teachers can register here. Administrator accounts are created separately by an existing admin.', formCard('Create staff account', 'Use a unique passphrase with at least 12 characters.', `${formField('Email address', 'email', 'email', { autocomplete: 'email', maxlength: 254 })}${formField('Password', 'password', 'password', { autocomplete: 'new-password', minlength: 12, maxlength: 128 })}`, 'Create staff account', 'register'));
}

function renderLogin() {
  setNavigation();
  shell('WELCOME BACK', 'Good to see you.', 'Sign in to your account. If two-factor authentication is enabled, you will verify with your authenticator next.', formCard('Sign in', 'Choose your access type, then enter your account details to continue.', `${selectField('Sign in as', 'role', [{ value: 'user', label: 'Staff / teacher' }, { value: 'admin', label: 'Administrator' }], 'user')}${formField('Email address', 'email', 'email', { autocomplete: 'email', maxlength: 254 })}${formField('Password', 'password', 'password', { autocomplete: 'current-password', maxlength: 128 })}`, 'Sign in', 'login'));
}

function renderTwoFactor() {
  setNavigation();
  shell('SECOND STEP', 'One more check.', 'Enter the current six-digit code from your authenticator app.', formCard('Verify identity', 'Codes can only be used once.', formField('Authenticator code', 'code', 'text', { inputmode: 'numeric', maxlength: 6 }), 'Verify and continue', 'verify'));
}

async function renderDashboard() {
  const [{ user }, overview] = await Promise.all([api('/api/me'), api('/api/school/overview')]);
  setNavigation(user);
  const recentRows = overview.recentAttendance.map((record) => `<tr><td><strong>${escapeHtml(record.first_name)} ${escapeHtml(record.last_name)}</strong><small>${escapeHtml(record.student_number)}</small></td><td>${new Date(record.attendance_date).toLocaleDateString()}</td><td><span class="attendance-pill pill-${escapeHtml(record.status)}">${escapeHtml(record.status)}</span></td></tr>`).join('');
  schoolPage('SCHOOL OVERVIEW', 'Good morning.', `Welcome back, ${escapeHtml(user.email)}. Here is the school at a glance.`, `<section class="stat-grid"><article class="stat-card stat-green"><span>ENROLLED STUDENTS</span><strong>${overview.counts.students}</strong><a href="/students">Open directory <span>→</span></a></article><article class="stat-card stat-yellow"><span>ACTIVE CLASSES</span><strong>${overview.counts.classes}</strong><a href="/classes">View classes <span>→</span></a></article><article class="stat-card stat-coral"><span>ATTENDANCE RECORDS</span><strong>${overview.counts.attendance}</strong><a href="/attendance">Take attendance <span>→</span></a></article><article class="stat-card stat-blue"><span>ASSESSMENTS</span><strong>${overview.counts.grades}</strong><a href="/grades">View grades <span>→</span></a></article></section><div class="dashboard-grid"><section class="data-panel"><div class="panel-heading"><div><p class="eyebrow">LATEST ACTIVITY</p><h2>Recent attendance</h2></div><a href="/attendance">View all <span>→</span></a></div><div class="table-wrap"><table><thead><tr><th>Student</th><th>Date</th><th>Status</th></tr></thead><tbody>${recentRows || '<tr><td colspan="3" class="empty-state">No attendance recorded yet.</td></tr>'}</tbody></table></div></section><aside class="welcome-panel"><span class="welcome-mark">K</span><p class="eyebrow">SIGNED IN AS ${escapeHtml(user.role.toUpperCase())}</p><h2>Your school, in sync.</h2><p>Keep student records, class details, attendance, and academic progress together.</p>${user.role === 'admin' ? '<a class="button button-primary" href="/students">Manage students <span aria-hidden="true">↗</span></a>' : '<a class="quiet-link" href="/security">Account security <span>→</span></a>'}</aside></div>`);
}

async function renderStudents() {
  const [{ user }, { students }, { classes }] = await Promise.all([api('/api/me'), api('/api/school/students'), api('/api/school/classes')]);
  studentsCache = students;
  classesCache = classes;
  setNavigation(user);
  const rows = students.map((student) => `<tr data-student-row="${student.id}"><td><strong>${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}</strong><small>${escapeHtml(student.student_number)}</small></td><td>Grade ${student.grade_level}</td><td>${escapeHtml(student.homeroom || 'Unassigned')}</td><td>${escapeHtml(student.email || '—')}</td><td class="row-actions">${user.role === 'admin' ? `<button class="icon-action" type="button" data-action="edit-student" data-id="${student.id}" aria-label="Edit ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}" title="Edit student">Edit</button>` : ''}<button class="icon-action danger-action" type="button" data-action="delete-student" data-id="${student.id}" aria-label="Remove ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}" title="Remove student">Delete</button></td></tr>`).join('');
  const form = user.role === 'admin' ? `<details class="form-drawer" id="student-drawer"><summary><span data-student-form-title>Add student</span><span aria-hidden="true">＋</span></summary><form data-form="student" class="record-form"><input type="hidden" name="studentId"><label class="field"><span>Student number</span><input name="studentNumber" maxlength="24" required></label>${formField('First name', 'firstName', 'text', { maxlength: 80 })}${formField('Last name', 'lastName', 'text', { maxlength: 80 })}${formField('Email (optional)', 'email', 'email', { maxlength: 254, required: false })}${selectField('Grade level', 'gradeLevel', gradeOptions())}${selectField('Homeroom', 'homeroomId', [{ value: '', label: 'Unassigned' }, ...classes.map((room) => ({ value: room.id, label: `${room.name} · Grade ${room.grade_level}` }))], '', false)}<div class="form-actions"><button class="button button-primary" type="submit">Save student</button><button class="button button-secondary" type="button" data-action="cancel-student-edit">Cancel edit</button></div></form></details>` : '';
  schoolPage('PEOPLE', 'Student directory', 'Enrollment details and homeroom assignments.', `<section class="data-panel"><div class="panel-heading"><div><p class="eyebrow">${students.length} RECORDS</p><h2>All students</h2></div>${user.role === 'admin' ? '<button class="button button-primary compact-button" type="button" data-action="open-student-form">Add student <span aria-hidden="true">＋</span></button>' : ''}</div>${form}<div class="table-wrap"><table><thead><tr><th>Student</th><th>Grade</th><th>Homeroom</th><th>Email</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty-state">No students yet.</td></tr>'}</tbody></table></div></section>`);
}

async function renderClasses() {
  const [{ user }, { classes }, { students }] = await Promise.all([api('/api/me'), api('/api/school/classes'), api('/api/school/students')]);
  classesCache = classes;
  studentsCache = students;
  setNavigation(user);
  const rows = classes.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.subject)}</small></td><td>Grade ${item.grade_level}</td><td>${escapeHtml(item.teacher_name)}</td><td>${escapeHtml(item.room || '—')}</td><td>${item.student_count}</td><td><button class="icon-action danger-action" type="button" data-action="delete-class" data-id="${item.id}" aria-label="Delete ${escapeHtml(item.name)}">Delete</button></td></tr>`).join('');
  const form = `<details class="form-drawer" id="class-drawer"><summary><span>Add a class</span><span aria-hidden="true">＋</span></summary><form data-form="class" class="record-form">${formField('Class name', 'name', 'text', { maxlength: 80 })}${formField('Subject', 'subject', 'text', { maxlength: 80 })}${selectField('Grade level', 'gradeLevel', gradeOptions())}${formField('Teacher', 'teacherName', 'text', { maxlength: 100 })}${formField('Room', 'room', 'text', { maxlength: 40, required: false })}<button class="button button-primary" type="submit">Save class</button></form></details>`;
  const rosterRows = students.map((student) => `<tr data-roster-row="${student.id}"><td><strong>${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}</strong><small>${escapeHtml(student.student_number)} · Grade ${student.grade_level}</small></td><td><select name="classId" aria-label="Class for ${escapeHtml(student.first_name)} ${escapeHtml(student.last_name)}"><option value="">Unassigned</option>${classes.map((item) => `<option value="${item.id}" ${String(item.id) === String(student.homeroom_id) ? 'selected' : ''}>${escapeHtml(item.name)} · Grade ${item.grade_level}</option>`).join('')}</select></td><td><button class="icon-action" type="button" data-action="save-roster" data-id="${student.id}">Save roster</button>${student.homeroom_id ? `<button class="icon-action danger-action" type="button" data-action="delete-roster" data-id="${student.id}">Remove assignment</button>` : ''}</td></tr>`).join('');
  schoolPage('ACADEMICS', 'Classes', 'Staff can create classes and organize students into homeroom rosters.', `<section class="data-panel"><div class="panel-heading"><div><p class="eyebrow">${classes.length} CLASSES</p><h2>Class list</h2></div></div>${form}<div class="table-wrap"><table><thead><tr><th>Class</th><th>Grade</th><th>Teacher</th><th>Room</th><th>Students</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty-state">No classes have been created yet.</td></tr>'}</tbody></table></div></section><section class="data-panel roster-panel"><div class="panel-heading"><div><p class="eyebrow">STAFF WORKSPACE</p><h2>Class roster assignments</h2></div></div><p class="panel-copy">Assign enrolled students to a homeroom. Student records are created by an administrator.</p><div class="table-wrap"><table><thead><tr><th>Student</th><th>Homeroom</th><th>Actions</th></tr></thead><tbody>${rosterRows || '<tr><td colspan="3" class="empty-state">No students are available to roster yet.</td></tr>'}</tbody></table></div></section>`);
}

async function renderAttendance() {
  const selectedDate = new URLSearchParams(window.location.search).get('date') || new Date().toISOString().slice(0, 10);
  const [{ user }, records] = await Promise.all([api('/api/me'), api(`/api/school/attendance?date=${encodeURIComponent(selectedDate)}`)]);
  setNavigation(user);
  const rows = records.attendance.map((record) => `<tr data-attendance-row="${record.student_id}"><td><strong>${escapeHtml(record.first_name)} ${escapeHtml(record.last_name)}</strong><small>${escapeHtml(record.student_number)} · Grade ${record.grade_level}</small></td><td><select name="status" aria-label="Attendance status for ${escapeHtml(record.first_name)} ${escapeHtml(record.last_name)}"><option value="present" ${record.status === 'present' ? 'selected' : ''}>Present</option><option value="absent" ${record.status === 'absent' ? 'selected' : ''}>Absent</option><option value="late" ${record.status === 'late' ? 'selected' : ''}>Late</option><option value="excused" ${record.status === 'excused' ? 'selected' : ''}>Excused</option></select></td><td><input name="note" aria-label="Attendance note for ${escapeHtml(record.first_name)} ${escapeHtml(record.last_name)}" maxlength="240" value="${escapeHtml(record.note || '')}" placeholder="Optional note"></td><td><button class="icon-action" type="button" data-action="save-attendance" data-id="${record.student_id}">Save</button>${record.status ? `<button class="icon-action danger-action" type="button" data-action="delete-attendance" data-id="${record.student_id}">Delete</button>` : ''}</td></tr>`).join('');
  const date = records.date;
  schoolPage('DAILY RECORDS', 'Attendance', 'Staff and teachers can mark each student present, absent, late, or excused.', `<section class="data-panel"><div class="panel-heading"><div><p class="eyebrow">DAILY ROLL CALL</p><h2>Student attendance</h2></div><label class="date-control">DATE<input type="date" id="attendance-date" value="${date}"></label></div><div class="table-wrap"><table><thead><tr><th>Student</th><th>Status</th><th>Note</th><th>Action</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="empty-state">Ask an administrator to add students before taking attendance.</td></tr>'}</tbody></table></div></section>`);
}

async function renderGrades() {
  const [{ user }, { students }, { classes }, { grades }] = await Promise.all([api('/api/me'), api('/api/school/students'), api('/api/school/classes'), api('/api/school/grades')]);
  studentsCache = students;
  classesCache = classes;
  setNavigation(user);
  const rows = grades.map((grade) => `<tr><td><strong>${escapeHtml(grade.first_name)} ${escapeHtml(grade.last_name)}</strong><small>${escapeHtml(grade.student_number)}</small></td><td>${escapeHtml(grade.assessment)}</td><td>${escapeHtml(grade.subject)} · ${escapeHtml(grade.class_name)}</td><td><strong>${Number(grade.score).toFixed(1)} / ${Number(grade.max_score).toFixed(1)}</strong></td><td>${new Date(grade.grade_date).toLocaleDateString()}</td>${user.role === 'admin' ? `<td><button class="icon-action danger-action" type="button" data-action="delete-grade" data-id="${grade.id}" aria-label="Remove ${escapeHtml(grade.assessment)} grade">Remove</button></td>` : ''}</tr>`).join('');
  const form = `<details class="form-drawer" id="grade-drawer"><summary><span>Record an assessment</span><span aria-hidden="true">＋</span></summary><form data-form="grade" class="record-form">${selectField('Student', 'studentId', [{ value: '', label: 'Choose student' }, ...students.map((student) => ({ value: student.id, label: `${student.first_name} ${student.last_name} · ${student.student_number}` }))])}${selectField('Class', 'classId', [{ value: '', label: 'Choose class' }, ...classes.map((item) => ({ value: item.id, label: `${item.subject} · ${item.name}` }))])}${formField('Assessment', 'assessment', 'text', { maxlength: 100 })}${formField('Score', 'score', 'number', { min: 0, max: 999.99, step: 'any' })}${formField('Out of', 'maxScore', 'number', { min: 0.01, max: 999.99, step: 'any' })}<label class="field"><span>Date</span><input type="date" name="gradeDate" value="${new Date().toISOString().slice(0, 10)}" required></label><button class="button button-primary" type="submit">Save assessment</button></form></details>`;
  schoolPage('ACADEMIC PROGRESS', 'Grades', 'Staff can record assessment scores. Only administrators can delete grade records.', `<section class="data-panel"><div class="panel-heading"><div><p class="eyebrow">${grades.length} ASSESSMENTS</p><h2>Gradebook</h2></div></div>${form}<div class="table-wrap"><table><thead><tr><th>Student</th><th>Assessment</th><th>Class</th><th>Score</th><th>Date</th>${user.role === 'admin' ? '<th>Action</th>' : ''}</tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty-state">No grades recorded yet.</td></tr>'}</tbody></table></div></section>`);
}

async function renderSecurity() {
  const { user } = await api('/api/me');
  setNavigation(user);
  const action = user.totp_enabled
    ? `<div class="security-status"><span class="status-dot status-on"></span><div><strong>Authenticator is on</strong><p>Sign-ins require a current code from your authenticator app.</p></div></div><div class="notice" data-message role="status" hidden></div><form data-form="disable-2fa" class="stacked-form">${formField('Current password', 'password', 'password', { autocomplete: 'current-password', maxlength: 128 })}${formField('Authenticator code', 'code', 'text', { inputmode: 'numeric', maxlength: 6 })}<button class="button button-secondary" type="submit">Turn off two-factor authentication</button></form>`
    : `<div class="security-status"><span class="status-dot"></span><div><strong>Authenticator is off</strong><p>Add a second verification step to protect your sign-in.</p></div></div><div class="notice" data-message role="status" hidden></div><div data-enrollment></div><button class="button button-primary" data-action="start-2fa" type="button">Set up authenticator <span aria-hidden="true">↗</span></button>`;
  shell('SECURITY SETTINGS', 'Add another layer.', 'Use any TOTP-compatible authenticator app to confirm it is really you.', `<div class="account-summary">${action}<a class="quiet-link" href="/change-password">Change your password <span aria-hidden="true">→</span></a></div>`);
}

function renderPassword() {
  setNavigation();
  shell('PASSWORD', 'Keep it current.', 'Choose a new password you do not use on another site. You will stay signed in on this device.', formCard('Change password', 'Your password is re-hashed with Argon2id when saved.', `${formField('Current password', 'currentPassword', 'password', { autocomplete: 'current-password', maxlength: 128 })}${formField('New password', 'newPassword', 'password', { autocomplete: 'new-password', minlength: 12, maxlength: 128 })}`, 'Update password', 'password'));
}

async function renderAdmin() {
  const { users } = await api('/api/admin/users');
  const rows = users.map((user) => `<tr><td>${escapeHtml(user.email)}</td><td><span class="role-tag">${escapeHtml(user.role)}</span></td><td>${user.totp_enabled ? 'On' : 'Off'}</td><td>${new Date(user.created_at).toLocaleDateString()}</td></tr>`).join('');
  setNavigation({ role: 'admin' });
  const accountForm = `<section class="data-panel account-create-panel"><div class="panel-heading"><div><p class="eyebrow">ADMIN ONLY</p><h2>Create an account</h2></div></div><p class="panel-copy">Create staff/teacher accounts or another administrator account. Share the temporary password securely.</p><div class="notice" data-message role="status" hidden></div><form data-form="account" class="record-form">${formField('Email address', 'email', 'email', { maxlength: 254 })}${formField('Temporary password', 'password', 'password', { autocomplete: 'new-password', minlength: 12, maxlength: 128 })}${selectField('Account type', 'role', [{ value: 'user', label: 'Staff / teacher' }, { value: 'admin', label: 'Administrator' }])}<button class="button button-primary" type="submit">Create account</button></form></section>`;
  schoolPage('ADMINISTRATION', 'Account management', 'Create staff or administrator accounts and review access.', `${accountForm}<section class="data-panel"><div class="panel-heading"><div><p class="eyebrow">${users.length} ACCOUNTS</p><h2>Accounts</h2></div></div><div class="table-wrap"><table><thead><tr><th>Email</th><th>Account type</th><th>2FA</th><th>Joined</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No accounts yet.</td></tr>'}</tbody></table></div></section>`);
}

const renderers = { home: renderHome, register: renderRegister, login: renderLogin, 'verify-2fa': renderTwoFactor, dashboard: renderDashboard, students: renderStudents, classes: renderClasses, attendance: renderAttendance, grades: renderGrades, security: renderSecurity, 'change-password': renderPassword, admin: renderAdmin };

function formValues(form) { return Object.fromEntries(new FormData(form).entries()); }

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-form]');
  if (!form || form.dataset.form === 'enable-2fa') return;
  event.preventDefault();
  const values = formValues(form);
  try {
    if (form.dataset.form === 'student') {
      const id = values.studentId;
      delete values.studentId;
      await api(id ? `/api/school/students/${encodeURIComponent(id)}` : '/api/school/students', {
        method: id ? 'PUT' : 'POST', body: JSON.stringify(values)
      });
      await renderStudents();
      showMessage(id ? 'Student details updated.' : 'Student added.');
    } else if (form.dataset.form === 'class') {
      await api('/api/school/classes', { method: 'POST', body: JSON.stringify(values) });
      await renderClasses();
      showMessage('Class added.');
    } else if (form.dataset.form === 'account') {
      await api('/api/admin/accounts', { method: 'POST', body: JSON.stringify(values) });
      await renderAdmin();
      showMessage('Account created. Share the temporary password securely.');
    } else if (form.dataset.form === 'grade') {
      await api('/api/school/grades', { method: 'POST', body: JSON.stringify(values) });
      await renderGrades();
      showMessage('Assessment recorded.');
    } else if (form.dataset.form === 'register') {
      await api('/api/register', { method: 'POST', body: JSON.stringify(values) });
      window.location.assign('/login?created=1');
    } else if (form.dataset.form === 'login') {
      const result = await api('/api/login', { method: 'POST', body: JSON.stringify(values) });
      window.location.assign(result.requiresTwoFactor ? '/verify-2fa' : '/dashboard');
    } else if (form.dataset.form === 'verify') {
      await api('/api/2fa/verify', { method: 'POST', body: JSON.stringify(values) });
      window.location.assign('/dashboard');
    } else if (form.dataset.form === 'password') {
      await api('/api/password', { method: 'POST', body: JSON.stringify(values) });
      form.reset();
      showMessage('Your password has been changed.');
    } else if (form.dataset.form === 'disable-2fa') {
      await api('/api/2fa/disable', { method: 'POST', body: JSON.stringify(values) });
      window.location.reload();
    }
  } catch (error) { showMessage(error.message, 'error'); }
});

document.addEventListener('click', async (event) => {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  try {
    if (control.dataset.action === 'toggle-password') {
      const input = control.closest('.input-with-action').querySelector('input');
      const isVisible = input.type === 'password';
      input.type = isVisible ? 'text' : 'password';
      control.textContent = isVisible ? 'Hide' : 'Show';
      control.setAttribute('aria-label', `${isVisible ? 'Hide' : 'Show'} password`);
      control.setAttribute('aria-pressed', String(isVisible));
    } else if (control.dataset.action === 'logout') {
      await api('/api/logout', { method: 'POST', body: '{}' });
      window.location.assign('/');
    } else if (control.dataset.action === 'open-student-form') {
      document.querySelector('#student-drawer').open = true;
      document.querySelector('#student-drawer').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (control.dataset.action === 'cancel-student-edit') {
      const form = document.querySelector('[data-form="student"]');
      form.reset();
      form.elements.studentId.value = '';
      document.querySelector('[data-student-form-title]').textContent = 'Add student';
      control.closest('details').open = false;
    } else if (control.dataset.action === 'edit-student') {
      const student = studentsCache.find((item) => String(item.id) === control.dataset.id);
      if (!student) return;
      const form = document.querySelector('[data-form="student"]');
      form.elements.studentId.value = student.id;
      form.elements.studentNumber.value = student.student_number;
      form.elements.firstName.value = student.first_name;
      form.elements.lastName.value = student.last_name;
      form.elements.email.value = student.email || '';
      form.elements.gradeLevel.value = student.grade_level;
      form.elements.homeroomId.value = student.homeroom_id || '';
      document.querySelector('[data-student-form-title]').textContent = 'Edit student';
      document.querySelector('#student-drawer').open = true;
      document.querySelector('#student-drawer').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (control.dataset.action === 'delete-student') {
      if (!window.confirm('Delete this student? Admins may also delete related attendance and grade history. Staff can only delete students without that history.')) return;
      await api(`/api/school/students/${encodeURIComponent(control.dataset.id)}`, { method: 'DELETE' });
      await renderStudents();
      showMessage('Student removed.');
    } else if (control.dataset.action === 'delete-class') {
      if (!window.confirm('Delete this class? Staff can only delete classes with no roster or grades. Admins may also delete related records.')) return;
      await api(`/api/school/classes/${encodeURIComponent(control.dataset.id)}`, { method: 'DELETE' });
      await renderClasses();
      showMessage('Class removed.');
    } else if (control.dataset.action === 'delete-roster') {
      if (!window.confirm('Remove this student from the class roster? The student record will remain.')) return;
      await api(`/api/school/roster/${encodeURIComponent(control.dataset.id)}`, { method: 'DELETE', body: '{}' });
      await renderClasses();
      showMessage('Student removed from the roster.');
    } else if (control.dataset.action === 'delete-attendance') {
      if (!window.confirm('Delete this attendance record?')) return;
      await api(`/api/school/attendance/${encodeURIComponent(control.dataset.id)}`, {
        method: 'DELETE', body: JSON.stringify({ date: document.querySelector('#attendance-date').value })
      });
      await renderAttendance();
      showMessage('Attendance record deleted.');
    } else if (control.dataset.action === 'delete-grade') {
      if (!window.confirm('Remove this assessment record?')) return;
      await api(`/api/school/grades/${encodeURIComponent(control.dataset.id)}`, { method: 'DELETE' });
      await renderGrades();
      showMessage('Assessment removed.');
    } else if (control.dataset.action === 'save-attendance') {
      const row = control.closest('[data-attendance-row]');
      await api(`/api/school/attendance/${encodeURIComponent(control.dataset.id)}`, {
        method: 'POST',
        body: JSON.stringify({
          date: document.querySelector('#attendance-date').value,
          status: row.querySelector('[name="status"]').value,
          note: row.querySelector('[name="note"]').value
        })
      });
      control.textContent = 'Saved';
      window.setTimeout(() => { if (control.isConnected) control.textContent = 'Save'; }, 1500);
    } else if (control.dataset.action === 'save-roster') {
      const row = control.closest('[data-roster-row]');
      await api(`/api/school/roster/${encodeURIComponent(control.dataset.id)}`, {
        method: 'PUT', body: JSON.stringify({ classId: row.querySelector('[name="classId"]').value })
      });
      control.textContent = 'Saved';
      window.setTimeout(() => { if (control.isConnected) control.textContent = 'Save roster'; }, 1500);
    } else if (control.dataset.action === 'start-2fa') {
      const result = await api('/api/2fa/setup', { method: 'POST', body: '{}' });
      const enrollment = document.querySelector('[data-enrollment]');
      enrollment.innerHTML = `<div class="qr-panel"><img src="${result.qrCode}" alt="Authenticator setup QR code"><div><p class="eyebrow">SCAN TO CONNECT</p><h3>Open your authenticator</h3><p>Scan this QR code, then enter the six-digit code it generates.</p><details><summary>Enter setup key manually</summary><code class="secret-key">${escapeHtml(result.secret)}</code></details></div></div><form data-form="enable-2fa" class="stacked-form">${formField('Authenticator code', 'code', 'text', { inputmode: 'numeric', maxlength: 6 })}<button class="button button-primary" type="submit">Confirm authenticator</button></form>`;
      control.remove();
    }
  } catch (error) { showMessage(error.message, 'error'); }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'attendance-date' && event.target.value) {
    window.location.assign(`/attendance?date=${encodeURIComponent(event.target.value)}`);
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-form="enable-2fa"]');
  if (!form) return;
  event.preventDefault();
  try {
    await api('/api/2fa/enable', { method: 'POST', body: JSON.stringify(formValues(form)) });
    window.location.reload();
  } catch (error) { showMessage(error.message, 'error'); }
});

if (page === 'login' && new URLSearchParams(window.location.search).has('created')) {
  renderLogin();
  showMessage('Your account is ready. Sign in to continue.');
} else {
  Promise.resolve(renderers[page] ? renderers[page]() : renderHome()).catch(() => window.location.assign('/login'));
}