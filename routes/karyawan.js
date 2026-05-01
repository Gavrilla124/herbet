const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { getDB } = require('../db/database');
const { authMiddleware } = require('./auth.middleware');

const storageProfil = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/profil');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `profil_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const uploadProfil = multer({ storage: storageProfil, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', authMiddleware, (req, res) => {
  const db = getDB();
  const { search, departemen_id, status } = req.query;
  let sql = `
    SELECT k.*, d.nama as departemen_nama, j.nama as jabatan_nama,
    u.username as username, u.id as user_id
    FROM karyawan k
    LEFT JOIN departemen d ON k.departemen_id = d.id
    LEFT JOIN jabatan j ON k.jabatan_id = j.id
    LEFT JOIN users u ON u.karyawan_id = k.id
    WHERE 1=1
  `;
  const params = [];
  if (search) { sql += ` AND (k.nama LIKE ? OR k.nip LIKE ? OR k.email LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (departemen_id) { sql += ` AND k.departemen_id = ?`; params.push(departemen_id); }
  if (status) { sql += ` AND k.status = ?`; params.push(status); }
  sql += ` ORDER BY k.nama`;
  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows });
});

router.get('/users/list', authMiddleware, (req, res) => {
  const db = getDB();
  const users = db.prepare(`
    SELECT u.id, u.username, u.role, u.last_login, u.created_at, k.nama as nama_karyawan, k.nip
    FROM users u LEFT JOIN karyawan k ON u.karyawan_id = k.id
    ORDER BY u.created_at DESC
  `).all();
  res.json({ success: true, data: users });
});

router.post('/users/reset-password', authMiddleware, (req, res) => {
  const db = getDB();
  const { user_id, new_password } = req.body;
  if (!user_id || !new_password) return res.json({ success: false, message: 'Data tidak lengkap' });
  const hashed = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, user_id);
  res.json({ success: true, message: 'Password berhasil direset' });
});

router.get('/:id', authMiddleware, (req, res) => {
  const db = getDB();
  const k = db.prepare(`
    SELECT k.*, d.nama as departemen_nama, j.nama as jabatan_nama, u.username as username
    FROM karyawan k
    LEFT JOIN departemen d ON k.departemen_id = d.id
    LEFT JOIN jabatan j ON k.jabatan_id = j.id
    LEFT JOIN users u ON u.karyawan_id = k.id
    WHERE k.id = ?
  `).get(req.params.id);
  if (!k) return res.json({ success: false, message: 'Karyawan tidak ditemukan' });
  res.json({ success: true, data: k });
});

router.post('/', authMiddleware, uploadProfil.single('foto_profil'), (req, res) => {
  const db = getDB();
  const { nip, nama, email, telepon, jenis_kelamin, tanggal_lahir, alamat, departemen_id, jabatan_id, tanggal_masuk, status, username, password } = req.body;
  const foto = req.file ? `/uploads/profil/${req.file.filename}` : null;
  try {
    const result = db.prepare(`INSERT INTO karyawan (nip, nama, email, telepon, jenis_kelamin, tanggal_lahir, alamat, foto_profil, departemen_id, jabatan_id, tanggal_masuk, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(nip, nama, email, telepon, jenis_kelamin, tanggal_lahir, alamat, foto, departemen_id, jabatan_id, tanggal_masuk, status || 'aktif');
    const karyawanId = result.lastInsertRowid;
    if (username && password) {
      const hashed = bcrypt.hashSync(password, 10);
      try { db.prepare(`INSERT INTO users (username, password, role, karyawan_id) VALUES (?, ?, 'karyawan', ?)`).run(username, hashed, karyawanId); } catch (e) {}
    }
    res.json({ success: true, message: 'Karyawan berhasil ditambahkan' + (username ? ' beserta akun login' : ''), id: karyawanId });
  } catch (e) {
    res.json({ success: false, message: 'NIP atau Email sudah digunakan: ' + e.message });
  }
});

router.put('/:id', authMiddleware, uploadProfil.single('foto_profil'), (req, res) => {
  const db = getDB();
  const { nip, nama, email, telepon, jenis_kelamin, tanggal_lahir, alamat, departemen_id, jabatan_id, tanggal_masuk, status, username, password } = req.body;
  const existing = db.prepare('SELECT * FROM karyawan WHERE id = ?').get(req.params.id);
  if (!existing) return res.json({ success: false, message: 'Karyawan tidak ditemukan' });
  const foto = req.file ? `/uploads/profil/${req.file.filename}` : existing.foto_profil;
  try {
    db.prepare(`UPDATE karyawan SET nip=?,nama=?,email=?,telepon=?,jenis_kelamin=?,tanggal_lahir=?,alamat=?,foto_profil=?,departemen_id=?,jabatan_id=?,tanggal_masuk=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(nip, nama, email, telepon, jenis_kelamin, tanggal_lahir, alamat, foto, departemen_id, jabatan_id, tanggal_masuk, status, req.params.id);
    if (username) {
      const existingUser = db.prepare('SELECT * FROM users WHERE karyawan_id = ?').get(req.params.id);
      if (existingUser) {
        if (password) { db.prepare('UPDATE users SET username=?,password=? WHERE karyawan_id=?').run(username, bcrypt.hashSync(password,10), req.params.id); }
        else { db.prepare('UPDATE users SET username=? WHERE karyawan_id=?').run(username, req.params.id); }
      } else if (password) {
        try { db.prepare(`INSERT INTO users (username, password, role, karyawan_id) VALUES (?, ?, 'karyawan', ?)`).run(username, bcrypt.hashSync(password,10), req.params.id); } catch(e) {}
      }
    }
    res.json({ success: true, message: 'Data karyawan berhasil diperbarui' });
  } catch (e) {
    res.json({ success: false, message: 'Error: ' + e.message });
  }
});

router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDB();
  db.prepare('UPDATE karyawan SET status = ? WHERE id = ?').run('nonaktif', req.params.id);
  res.json({ success: true, message: 'Karyawan dinonaktifkan' });
});

module.exports = router;
