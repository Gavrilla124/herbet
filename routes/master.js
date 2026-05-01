const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const { authMiddleware } = require('./auth.middleware');

// ===== DEPARTEMEN =====
router.get('/departemen', authMiddleware, (req, res) => {
  const db = getDB();
  const rows = db.prepare(`SELECT d.*, COUNT(k.id) as jumlah_karyawan FROM departemen d LEFT JOIN karyawan k ON d.id = k.departemen_id AND k.status = 'aktif' GROUP BY d.id`).all();
  res.json({ success: true, data: rows });
});

router.post('/departemen', authMiddleware, (req, res) => {
  const db = getDB();
  const { nama, kode } = req.body;
  try {
    const r = db.prepare('INSERT INTO departemen (nama, kode, perusahaan_id) VALUES (?, ?, 1)').run(nama, kode);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) {
    res.json({ success: false, message: 'Kode sudah ada' });
  }
});

router.put('/departemen/:id', authMiddleware, (req, res) => {
  const db = getDB();
  const { nama, kode } = req.body;
  db.prepare('UPDATE departemen SET nama=?, kode=? WHERE id=?').run(nama, kode, req.params.id);
  res.json({ success: true });
});

router.delete('/departemen/:id', authMiddleware, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM departemen WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ===== JABATAN =====
router.get('/jabatan', authMiddleware, (req, res) => {
  const db = getDB();
  const { departemen_id } = req.query;
  let sql = `SELECT j.*, d.nama as departemen_nama FROM jabatan j LEFT JOIN departemen d ON j.departemen_id = d.id`;
  const params = [];
  if (departemen_id) { sql += ' WHERE j.departemen_id = ?'; params.push(departemen_id); }
  res.json({ success: true, data: db.prepare(sql).all(...params) });
});

router.post('/jabatan', authMiddleware, (req, res) => {
  const db = getDB();
  const { nama, level, departemen_id } = req.body;
  const r = db.prepare('INSERT INTO jabatan (nama, level, departemen_id) VALUES (?, ?, ?)').run(nama, level || 1, departemen_id);
  res.json({ success: true, id: r.lastInsertRowid });
});

// ===== LAPORAN =====
router.get('/laporan/bulanan', authMiddleware, (req, res) => {
  const db = getDB();
  const { bulan, tahun } = req.query;
  const bln = bulan || require('moment')().format('MM');
  const thn = tahun || require('moment')().format('YYYY');

  const rows = db.prepare(`
    SELECT
      k.id, k.nip, k.nama, d.nama as departemen,
      COUNT(a.id) as total_hadir,
      SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) as hadir,
      SUM(CASE WHEN a.status = 'terlambat' THEN 1 ELSE 0 END) as terlambat,
      SUM(CASE WHEN a.status = 'izin' THEN 1 ELSE 0 END) as izin,
      SUM(CASE WHEN a.status = 'sakit' THEN 1 ELSE 0 END) as sakit,
      SUM(CASE WHEN a.status = 'alpha' THEN 1 ELSE 0 END) as alpha,
      SUM(CASE WHEN a.status = 'cuti' THEN 1 ELSE 0 END) as cuti,
      MIN(a.jam_masuk) as jam_masuk_paling_awal,
      MAX(a.jam_masuk) as jam_masuk_paling_akhir
    FROM karyawan k
    LEFT JOIN absensi a ON k.id = a.karyawan_id
      AND strftime('%m', a.tanggal) = ?
      AND strftime('%Y', a.tanggal) = ?
    LEFT JOIN departemen d ON k.departemen_id = d.id
    WHERE k.status = 'aktif'
    GROUP BY k.id
    ORDER BY k.nama
  `).all(bln, thn);

  res.json({ success: true, data: rows, bulan: bln, tahun: thn });
});

router.get('/laporan/harian', authMiddleware, (req, res) => {
  const db = getDB();
  const { tanggal } = req.query;
  const tgl = tanggal || require('moment')().format('YYYY-MM-DD');

  const hadirList = db.prepare(`
    SELECT a.*, k.nama, k.nip, d.nama as departemen
    FROM absensi a JOIN karyawan k ON a.karyawan_id = k.id
    LEFT JOIN departemen d ON k.departemen_id = d.id
    WHERE a.tanggal = ?
    ORDER BY a.jam_masuk ASC
  `).all(tgl);

  const alphaList = db.prepare(`
    SELECT k.nip, k.nama, d.nama as departemen
    FROM karyawan k
    LEFT JOIN departemen d ON k.departemen_id = d.id
    WHERE k.status = 'aktif' AND k.id NOT IN (
      SELECT karyawan_id FROM absensi WHERE tanggal = ?
    )
    ORDER BY k.nama
  `).all(tgl);

  res.json({ success: true, hadir: hadirList, alpha: alphaList, tanggal: tgl });
});

module.exports = router;
