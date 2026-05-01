const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '../db/absensi.db');

let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    -- Tabel Perusahaan
    CREATE TABLE IF NOT EXISTS perusahaan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      alamat TEXT,
      telepon TEXT,
      logo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabel Departemen
    CREATE TABLE IF NOT EXISTS departemen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      kode TEXT UNIQUE NOT NULL,
      perusahaan_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (perusahaan_id) REFERENCES perusahaan(id)
    );

    -- Tabel Jabatan
    CREATE TABLE IF NOT EXISTS jabatan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      departemen_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (departemen_id) REFERENCES departemen(id)
    );

    -- Tabel Karyawan
    CREATE TABLE IF NOT EXISTS karyawan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nip TEXT UNIQUE NOT NULL,
      nama TEXT NOT NULL,
      email TEXT UNIQUE,
      telepon TEXT,
      jenis_kelamin TEXT CHECK(jenis_kelamin IN ('L','P')),
      tanggal_lahir DATE,
      alamat TEXT,
      foto_profil TEXT,
      departemen_id INTEGER,
      jabatan_id INTEGER,
      tanggal_masuk DATE,
      status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif','nonaktif','cuti')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (departemen_id) REFERENCES departemen(id),
      FOREIGN KEY (jabatan_id) REFERENCES jabatan(id)
    );

    -- Tabel Admin/User Login
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin' CHECK(role IN ('superadmin','admin','karyawan')),
      karyawan_id INTEGER,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (karyawan_id) REFERENCES karyawan(id)
    );

    -- Tabel Jadwal Kerja
    CREATE TABLE IF NOT EXISTS jadwal_kerja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      jam_masuk TIME NOT NULL,
      jam_keluar TIME NOT NULL,
      toleransi_terlambat INTEGER DEFAULT 15,
      hari_kerja TEXT DEFAULT '1,2,3,4,5',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabel Absensi (UTAMA)
    CREATE TABLE IF NOT EXISTS absensi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      karyawan_id INTEGER NOT NULL,
      tanggal DATE NOT NULL,
      jam_masuk TIME,
      jam_keluar TIME,
      foto_masuk TEXT,
      foto_keluar TEXT,
      lokasi_masuk TEXT,
      lokasi_keluar TEXT,
      status TEXT DEFAULT 'hadir' CHECK(status IN ('hadir','terlambat','izin','sakit','alpha','cuti')),
      keterangan TEXT,
      diverifikasi INTEGER DEFAULT 0,
      verified_by INTEGER,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (karyawan_id) REFERENCES karyawan(id),
      FOREIGN KEY (verified_by) REFERENCES users(id),
      UNIQUE(karyawan_id, tanggal)
    );

    -- Tabel Izin/Cuti
    CREATE TABLE IF NOT EXISTS pengajuan_izin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      karyawan_id INTEGER NOT NULL,
      jenis TEXT CHECK(jenis IN ('izin','sakit','cuti','dinas')),
      tanggal_mulai DATE NOT NULL,
      tanggal_selesai DATE NOT NULL,
      keterangan TEXT,
      dokumen TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','disetujui','ditolak')),
      diproses_oleh INTEGER,
      diproses_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (karyawan_id) REFERENCES karyawan(id),
      FOREIGN KEY (diproses_oleh) REFERENCES users(id)
    );

    -- Tabel Notifikasi
    CREATE TABLE IF NOT EXISTS notifikasi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      judul TEXT NOT NULL,
      pesan TEXT NOT NULL,
      tipe TEXT DEFAULT 'info',
      dibaca INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Index untuk performa
    CREATE INDEX IF NOT EXISTS idx_absensi_karyawan ON absensi(karyawan_id);
    CREATE INDEX IF NOT EXISTS idx_absensi_tanggal ON absensi(tanggal);
    CREATE INDEX IF NOT EXISTS idx_karyawan_departemen ON karyawan(departemen_id);
  `);

  // Seed data awal
  seedData();
}

function seedData() {
  const perusahaanCount = db.prepare('SELECT COUNT(*) as count FROM perusahaan').get();
  if (perusahaanCount.count > 0) return;

  // Insert perusahaan
  db.prepare(`INSERT INTO perusahaan (nama, alamat, telepon) VALUES (?, ?, ?)`).run(
    'PT. Maju Bersama Indonesia', 'Jl. Sudirman No. 100, Jakarta Pusat', '021-5551234'
  );

  // Insert departemen
  const depts = [
    ['Teknologi Informasi', 'TI'],
    ['Sumber Daya Manusia', 'SDM'],
    ['Keuangan', 'KEU'],
    ['Marketing', 'MKT'],
    ['Operasional', 'OPS'],
  ];
  const insertDept = db.prepare(`INSERT INTO departemen (nama, kode, perusahaan_id) VALUES (?, ?, 1)`);
  depts.forEach(d => insertDept.run(d[0], d[1]));

  // Insert jabatan
  const jabatans = [
    ['Manager TI', 3, 1], ['Staff Developer', 2, 1], ['Staff IT Support', 1, 1],
    ['Manager SDM', 3, 2], ['Staff HRD', 1, 2],
    ['Manager Keuangan', 3, 3], ['Akuntan', 2, 3],
    ['Manager Marketing', 3, 4], ['Staff Marketing', 1, 4],
    ['Supervisor Operasional', 2, 5], ['Staff Operasional', 1, 5],
  ];
  const insertJab = db.prepare(`INSERT INTO jabatan (nama, level, departemen_id) VALUES (?, ?, ?)`);
  jabatans.forEach(j => insertJab.run(j[0], j[1], j[2]));

  // Insert jadwal kerja
  db.prepare(`INSERT INTO jadwal_kerja (nama, jam_masuk, jam_keluar, toleransi_terlambat) VALUES (?, ?, ?, ?)`).run(
    'Shift Reguler', '08:00', '17:00', 15
  );

  // Insert karyawan sample
  const karyawanData = [
    ['KRY001', 'Budi Santoso', 'budi@company.com', '081234567890', 'L', 1, 1],
    ['KRY002', 'Siti Rahayu', 'siti@company.com', '081234567891', 'P', 1, 2],
    ['KRY003', 'Ahmad Fauzi', 'ahmad@company.com', '081234567892', 'L', 2, 4],
    ['KRY004', 'Dewi Kusuma', 'dewi@company.com', '081234567893', 'P', 2, 5],
    ['KRY005', 'Riko Pratama', 'riko@company.com', '081234567894', 'L', 3, 6],
    ['KRY006', 'Laila Hasan', 'laila@company.com', '081234567895', 'P', 4, 8],
    ['KRY007', 'Doni Wijaya', 'doni@company.com', '081234567896', 'L', 5, 10],
  ];
  const insertKry = db.prepare(`INSERT INTO karyawan (nip, nama, email, telepon, jenis_kelamin, departemen_id, jabatan_id, tanggal_masuk, status) VALUES (?, ?, ?, ?, ?, ?, ?, '2023-01-01', 'aktif')`);
  karyawanData.forEach(k => insertKry.run(...k));

  // Insert admin user
  const hashedPass = bcrypt.hashSync('admin123', 10);
  db.prepare(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`).run('admin', hashedPass, 'superadmin');

  const hashedPass2 = bcrypt.hashSync('hr123', 10);
  db.prepare(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`).run('hrmanager', hashedPass2, 'admin');

  console.log('✅ Database seed berhasil!');
}

module.exports = { getDB };
