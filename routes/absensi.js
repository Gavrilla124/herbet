const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const { getDB } = require('../db/database');
const { authMiddleware } = require('./auth.middleware');

// Setup multer untuk foto absensi
const storageAbsensi = multer.diskStorage({
  destination: (req, file, cb) => {
    const today = moment().format('YYYY-MM');
    const dir = path.join(__dirname, `../public/uploads/absensi/${today}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `absensi_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const uploadAbsensi = multer({
  storage: storageAbsensi,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Hanya file gambar yang diperbolehkan'));
  }
});

// ABSEN MASUK (dengan foto wajib)
router.post('/masuk', authMiddleware, uploadAbsensi.single('foto'), (req, res) => {
  const db = getDB();
  const { karyawan_id, lokasi } = req.body;
  if (!req.file) return res.json({ success: false, message: 'Foto wajib diunggah untuk absen masuk!' });
  if (!karyawan_id) return res.json({ success: false, message: 'ID karyawan diperlukan' });

  const today = moment().format('YYYY-MM-DD');
  const jamSekarang = moment().format('HH:mm');

  // Cek sudah absen hari ini
  const existing = db.prepare('SELECT * FROM absensi WHERE karyawan_id = ? AND tanggal = ?').get(karyawan_id, today);
  if (existing && existing.jam_masuk) {
    return res.json({ success: false, message: `Anda sudah absen masuk hari ini pukul ${existing.jam_masuk}` });
  }

  // Tentukan status (hadir/terlambat)
  const jadwal = db.prepare('SELECT * FROM jadwal_kerja LIMIT 1').get();
  let status = 'hadir';
  if (jadwal) {
    const jamMasukJadwal = moment(jadwal.jam_masuk, 'HH:mm');
    const toleransi = moment(jadwal.jam_masuk, 'HH:mm').add(jadwal.toleransi_terlambat, 'minutes');
    const jamAbsen = moment(jamSekarang, 'HH:mm');
    if (jamAbsen.isAfter(toleransi)) status = 'terlambat';
  }

  const fotoPath = `/uploads/absensi/${moment().format('YYYY-MM')}/${req.file.filename}`;

  if (existing) {
    db.prepare('UPDATE absensi SET jam_masuk=?, foto_masuk=?, lokasi_masuk=?, status=? WHERE id=?').run(jamSekarang, fotoPath, lokasi || null, status, existing.id);
  } else {
    db.prepare('INSERT INTO absensi (karyawan_id, tanggal, jam_masuk, foto_masuk, lokasi_masuk, status) VALUES (?, ?, ?, ?, ?, ?)').run(karyawan_id, today, jamSekarang, fotoPath, lokasi || null, status);
  }

  const karyawan = db.prepare('SELECT nama FROM karyawan WHERE id = ?').get(karyawan_id);
  res.json({
    success: true,
    message: `Absen masuk berhasil! ${status === 'terlambat' ? '⚠️ Terlambat' : '✅ Tepat Waktu'}`,
    data: { jam: jamSekarang, status, karyawan: karyawan?.nama }
  });
});

// ABSEN KELUAR (dengan foto wajib)
router.post('/keluar', authMiddleware, uploadAbsensi.single('foto'), (req, res) => {
  const db = getDB();
  const { karyawan_id, lokasi } = req.body;
  if (!req.file) return res.json({ success: false, message: 'Foto wajib diunggah untuk absen keluar!' });

  const today = moment().format('YYYY-MM-DD');
  const jamSekarang = moment().format('HH:mm');

  const absensi = db.prepare('SELECT * FROM absensi WHERE karyawan_id = ? AND tanggal = ?').get(karyawan_id, today);
  if (!absensi || !absensi.jam_masuk) return res.json({ success: false, message: 'Anda belum absen masuk hari ini' });
  if (absensi.jam_keluar) return res.json({ success: false, message: `Anda sudah absen keluar pukul ${absensi.jam_keluar}` });

  const fotoPath = `/uploads/absensi/${moment().format('YYYY-MM')}/${req.file.filename}`;

  // Hitung durasi kerja
  const masuk = moment(absensi.jam_masuk, 'HH:mm');
  const keluar = moment(jamSekarang, 'HH:mm');
  const durasi = keluar.diff(masuk, 'hours', true).toFixed(1);

  db.prepare('UPDATE absensi SET jam_keluar=?, foto_keluar=?, lokasi_keluar=? WHERE id=?').run(jamSekarang, fotoPath, lokasi || null, absensi.id);

  res.json({
    success: true,
    message: `Absen keluar berhasil! Durasi kerja: ${durasi} jam`,
    data: { jam: jamSekarang, durasi_kerja: `${durasi} jam` }
  });
});

// GET data absensi hari ini (semua karyawan)
router.get('/hari-ini', authMiddleware, (req, res) => {
  const db = getDB();
  const today = moment().format('YYYY-MM-DD');
  const rows = db.prepare(`
    SELECT a.*, k.nama, k.nip, k.foto_profil, d.nama as departemen
    FROM absensi a
    JOIN karyawan k ON a.karyawan_id = k.id
    LEFT JOIN departemen d ON k.departemen_id = d.id
    WHERE a.tanggal = ?
    ORDER BY a.jam_masuk ASC
  `).all(today);
  res.json({ success: true, data: rows, tanggal: today });
});

// GET rekap absensi per karyawan
router.get('/rekap/:karyawan_id', authMiddleware, (req, res) => {
  const db = getDB();
  const { bulan, tahun } = req.query;
  const bln = bulan || moment().format('MM');
  const thn = tahun || moment().format('YYYY');
  const rows = db.prepare(`
    SELECT * FROM absensi
    WHERE karyawan_id = ? AND strftime('%m', tanggal) = ? AND strftime('%Y', tanggal) = ?
    ORDER BY tanggal ASC
  `).all(req.params.karyawan_id, bln, thn);

  const total = rows.length;
  const hadir = rows.filter(r => r.status === 'hadir').length;
  const terlambat = rows.filter(r => r.status === 'terlambat').length;
  const izin = rows.filter(r => r.status === 'izin').length;
  const alpha = rows.filter(r => r.status === 'alpha').length;

  res.json({ success: true, data: rows, statistik: { total, hadir, terlambat, izin, alpha } });
});

// GET semua absensi dengan filter
router.get('/', authMiddleware, (req, res) => {
  const db = getDB();
  const { tanggal, karyawan_id, departemen_id, status, bulan, tahun } = req.query;

  let sql = `
    SELECT a.*, k.nama, k.nip, k.foto_profil, d.nama as departemen, j.nama as jabatan
    FROM absensi a
    JOIN karyawan k ON a.karyawan_id = k.id
    LEFT JOIN departemen d ON k.departemen_id = d.id
    LEFT JOIN jabatan j ON k.jabatan_id = j.id
    WHERE 1=1
  `;
  const params = [];

  if (tanggal) { sql += ` AND a.tanggal = ?`; params.push(tanggal); }
  if (karyawan_id) { sql += ` AND a.karyawan_id = ?`; params.push(karyawan_id); }
  if (departemen_id) { sql += ` AND k.departemen_id = ?`; params.push(departemen_id); }
  if (status) { sql += ` AND a.status = ?`; params.push(status); }
  if (bulan) { sql += ` AND strftime('%m', a.tanggal) = ?`; params.push(bulan); }
  if (tahun) { sql += ` AND strftime('%Y', a.tanggal) = ?`; params.push(tahun); }

  sql += ` ORDER BY a.tanggal DESC, a.jam_masuk ASC`;

  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows, total: rows.length });
});

// Verifikasi absensi
router.put('/verifikasi/:id', authMiddleware, (req, res) => {
  const db = getDB();
  db.prepare('UPDATE absensi SET diverifikasi=1, verified_by=?, verified_at=CURRENT_TIMESTAMP WHERE id=?').run(req.user.id, req.params.id);
  res.json({ success: true, message: 'Absensi berhasil diverifikasi' });
});

// Tambah absensi manual (admin)
router.post('/manual', authMiddleware, (req, res) => {
  const db = getDB();
  const { karyawan_id, tanggal, jam_masuk, jam_keluar, status, keterangan } = req.body;
  try {
    const existing = db.prepare('SELECT id FROM absensi WHERE karyawan_id = ? AND tanggal = ?').get(karyawan_id, tanggal);
    if (existing) {
      db.prepare('UPDATE absensi SET jam_masuk=?, jam_keluar=?, status=?, keterangan=? WHERE id=?').run(jam_masuk, jam_keluar, status, keterangan, existing.id);
    } else {
      db.prepare('INSERT INTO absensi (karyawan_id, tanggal, jam_masuk, jam_keluar, status, keterangan) VALUES (?, ?, ?, ?, ?, ?)').run(karyawan_id, tanggal, jam_masuk, jam_keluar, status, keterangan);
    }
    res.json({ success: true, message: 'Absensi manual berhasil disimpan' });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// DASHBOARD STATISTIK
router.get('/dashboard/stats', authMiddleware, (req, res) => {
  const db = getDB();
  const today = moment().format('YYYY-MM-DD');
  const bulan = moment().format('MM');
  const tahun = moment().format('YYYY');

  const totalKaryawan = db.prepare(`SELECT COUNT(*) as count FROM karyawan WHERE status = 'aktif'`).get().count;
  const hadirHariIni = db.prepare(`SELECT COUNT(*) as count FROM absensi WHERE tanggal = ?`).get(today).count;
  const terlambatHariIni = db.prepare(`SELECT COUNT(*) as count FROM absensi WHERE tanggal = ? AND status = 'terlambat'`).get(today).count;
  const alphaBulanIni = db.prepare(`SELECT COUNT(*) as count FROM absensi WHERE strftime('%m', tanggal) = ? AND strftime('%Y', tanggal) = ? AND status = 'alpha'`).get(bulan, tahun).count;
  const izinBulanIni = db.prepare(`SELECT COUNT(*) as count FROM absensi WHERE strftime('%m', tanggal) = ? AND strftime('%Y', tanggal) = ? AND status IN ('izin','sakit')`).get(bulan, tahun).count;

  // 7 hari terakhir
  const tren7Hari = [];
  for (let i = 6; i >= 0; i--) {
    const tgl = moment().subtract(i, 'days').format('YYYY-MM-DD');
    const label = moment().subtract(i, 'days').format('DD/MM');
    const hadir = db.prepare(`SELECT COUNT(*) as count FROM absensi WHERE tanggal = ? AND jam_masuk IS NOT NULL`).get(tgl).count;
    tren7Hari.push({ tanggal: tgl, label, hadir });
  }

  res.json({
    success: true,
    data: { totalKaryawan, hadirHariIni, terlambatHariIni, alphaBulanIni, izinBulanIni, tren7Hari }
  });
});

// HAPUS ABSENSI (admin/manager only)
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDB();
  // Hanya admin/superadmin/manager yang boleh hapus
  if (req.user.role === 'karyawan') {
    return res.json({ success: false, message: 'Anda tidak memiliki izin untuk menghapus absensi' });
  }
  const absensi = db.prepare('SELECT * FROM absensi WHERE id = ?').get(req.params.id);
  if (!absensi) {
    return res.json({ success: false, message: 'Data absensi tidak ditemukan' });
  }
  // Hapus file foto jika ada
  try {
    if (absensi.foto_masuk) {
      const fotoPath = require('path').join(__dirname, '../public', absensi.foto_masuk);
      if (require('fs').existsSync(fotoPath)) require('fs').unlinkSync(fotoPath);
    }
    if (absensi.foto_keluar) {
      const fotoPath = require('path').join(__dirname, '../public', absensi.foto_keluar);
      if (require('fs').existsSync(fotoPath)) require('fs').unlinkSync(fotoPath);
    }
  } catch(e) { /* abaikan error hapus file */ }

  db.prepare('DELETE FROM absensi WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Data absensi berhasil dihapus' });
});

module.exports = router;
