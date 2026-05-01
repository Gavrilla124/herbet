const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDB } = require('../db/database');
const { generateToken } = require('./auth.middleware');

// LOGIN
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: 'Username dan password wajib diisi' });

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.json({ success: false, message: 'Username tidak ditemukan' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.json({ success: false, message: 'Password salah' });

  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  const token = generateToken(user);

  // Ambil nama karyawan jika akun terhubung ke data karyawan
  let nama_karyawan = null;
  if (user.karyawan_id) {
    const k = db.prepare('SELECT nama FROM karyawan WHERE id = ?').get(user.karyawan_id);
    if (k) nama_karyawan = k.nama;
  }

  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, role: user.role, karyawan_id: user.karyawan_id, nama_karyawan }
  });
});

// GANTI PASSWORD
router.post('/change-password', (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(oldPassword, user.password)) {
    return res.json({ success: false, message: 'Data tidak valid' });
  }
  const hashed = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user.id);
  res.json({ success: true, message: 'Password berhasil diubah' });
});

// TAMBAH USER
router.post('/register', (req, res) => {
  const { username, password, role, karyawan_id } = req.body;
  const db = getDB();
  try {
    const hashed = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (username, password, role, karyawan_id) VALUES (?, ?, ?, ?)').run(username, hashed, role || 'admin', karyawan_id || null);
    res.json({ success: true, message: 'User berhasil dibuat' });
  } catch (e) {
    res.json({ success: false, message: 'Username sudah ada' });
  }
});

module.exports = router;
