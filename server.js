const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const ROOT = __dirname;
const DB_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function ensureDb() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], sessions: [], bookings: [], appliances: [], contacts: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { users: [], sessions: [], bookings: [], appliances: [], contacts: [] };
  }
}

function writeDb(db) {
  ensureDb();
  const temp = DB_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(db, null, 2));
  fs.renameSync(temp, DB_FILE);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, status, message) {
  sendJson(res, status, { success: false, error: message });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, original] = stored.split(':');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(original, 'hex'));
  } catch {
    return false;
  }
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function makeBookingId() {
  return `QF-${Math.floor(100000 + Math.random() * 900000)}`;
}

function getToken(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

function getUserFromRequest(req, db) {
  const token = getToken(req);
  if (!token) return null;
  const session = db.sessions.find(s => s.token === token);
  if (!session) return null;
  return db.users.find(u => u.id === session.userId) || null;
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    return res.end();
  }

  const db = readDb();

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { success: true, service: 'Quick Fix API', status: 'online', time: new Date().toISOString() });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/signup') {
    let body;
    try { body = await parseJsonBody(req); } catch (e) { return sendError(res, 400, e.message); }
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!name || !phone || !email || password.length < 6) {
      return sendError(res, 400, 'Name, phone, email and a password of at least 6 characters are required.');
    }
    if (db.users.some(u => u.email === email || u.phone === phone)) {
      return sendError(res, 409, 'An account with this email or phone already exists.');
    }

    const user = {
      id: makeId('user'), name, phone, email,
      passwordHash: hashPassword(password),
      addresses: [], createdAt: new Date().toISOString()
    };
    const token = crypto.randomBytes(32).toString('hex');
    db.users.push(user);
    db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
    writeDb(db);
    return sendJson(res, 201, { success: true, token, user: publicUser(user) });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    let body;
    try { body = await parseJsonBody(req); } catch (e) { return sendError(res, 400, e.message); }
    const identifier = String(body.identifier || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = db.users.find(u => u.email.toLowerCase() === identifier || u.phone === identifier);
    if (!user || !verifyPassword(password, user.passwordHash)) return sendError(res, 401, 'Invalid email/phone or password.');

    const token = crypto.randomBytes(32).toString('hex');
    db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
    writeDb(db);
    return sendJson(res, 200, { success: true, token, user: publicUser(user) });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = getToken(req);
    db.sessions = db.sessions.filter(s => s.token !== token);
    writeDb(db);
    return sendJson(res, 200, { success: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/me') {
    const user = getUserFromRequest(req, db);
    if (!user) return sendError(res, 401, 'Authentication required.');
    return sendJson(res, 200, { success: true, user: publicUser(user) });
  }

  if (req.method === 'GET' && url.pathname === '/api/bookings') {
    const user = getUserFromRequest(req, db);
    if (!user) return sendError(res, 401, 'Please log in to view bookings.');
    return sendJson(res, 200, { success: true, bookings: db.bookings.filter(b => b.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  }

  if (req.method === 'POST' && url.pathname === '/api/bookings') {
    let body;
    try { body = await parseJsonBody(req); } catch (e) { return sendError(res, 400, e.message); }
    const user = getUserFromRequest(req, db);
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const address = String(body.address || '').trim();
    const service = String(body.service || '').trim();
    const date = String(body.date || '').trim();
    const timeSlot = String(body.timeSlot || '').trim();
    const issue = String(body.issue || '').trim();

    if (!name || !phone || !address || !service || !date || !timeSlot) return sendError(res, 400, 'Please complete all booking details.');

    const booking = {
      id: makeBookingId(),
      userId: user?.id || null,
      customerName: name,
      phone,
      address,
      service,
      issue,
      date,
      timeSlot,
      status: 'Confirmed',
      technician: { name: 'Rahul Sharma', status: 'Assigned' },
      createdAt: new Date().toISOString()
    };
    db.bookings.push(booking);
    writeDb(db);
    return sendJson(res, 201, { success: true, booking });
  }

  if (req.method === 'GET' && url.pathname === '/api/appliances') {
    const user = getUserFromRequest(req, db);
    if (!user) return sendError(res, 401, 'Please log in to view appliances.');
    return sendJson(res, 200, { success: true, appliances: db.appliances.filter(a => a.userId === user.id) });
  }

  if (req.method === 'POST' && url.pathname === '/api/appliances') {
    const user = getUserFromRequest(req, db);
    if (!user) return sendError(res, 401, 'Please log in to add an appliance.');
    let body;
    try { body = await parseJsonBody(req); } catch (e) { return sendError(res, 400, e.message); }
    if (!body.name) return sendError(res, 400, 'Appliance name is required.');
    const appliance = { id: makeId('app'), userId: user.id, name: String(body.name), brand: String(body.brand || ''), model: String(body.model || ''), status: 'Healthy', createdAt: new Date().toISOString() };
    db.appliances.push(appliance);
    writeDb(db);
    return sendJson(res, 201, { success: true, appliance });
  }

  if (req.method === 'POST' && url.pathname === '/api/contact') {
    let body;
    try { body = await parseJsonBody(req); } catch (e) { return sendError(res, 400, e.message); }
    if (!body.name || !body.phone) return sendError(res, 400, 'Name and phone are required.');
    db.contacts.push({ id: makeId('contact'), name: String(body.name), phone: String(body.phone), message: String(body.message || ''), createdAt: new Date().toISOString() });
    writeDb(db);
    return sendJson(res, 201, { success: true, message: 'Request received.' });
  }

  return sendError(res, 404, 'API route not found.');
}

function safeStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relative);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) return null;
  return filePath;
}

function serveStatic(req, res, url) {
  let filePath = safeStaticPath(url.pathname);
  if (!filePath) {
    res.writeHead(400); return res.end('Bad request');
  }

  if (!path.extname(filePath) && fs.existsSync(filePath + '.jsx')) filePath += '.jsx';
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    filePath = path.join(ROOT, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(500); return res.end('Server error'); }
    res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': CORS_ORIGIN });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendError(res, 405, 'Method not allowed.');
    return serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Internal server error.');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Quick Fix server running at http://localhost:${PORT}`);
  console.log(`API health: http://localhost:${PORT}/api/health`);
});
