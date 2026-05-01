# 🏢 SiAbsen — Sistem Absensi Karyawan

Aplikasi absensi karyawan berbasis web dengan upload foto, database SQLite, dan panel admin lengkap.

---

## ✨ Fitur Utama

- **Absen Masuk & Keluar** dengan upload foto wajib (bukti kehadiran)
- **Dashboard real-time** dengan statistik dan grafik kehadiran
- **Rekap absensi** harian dengan filter departemen & status
- **Laporan bulanan** per karyawan (hadir, terlambat, izin, sakit, alpha, cuti)
- **Manajemen karyawan** lengkap (CRUD + foto profil)
- **Manajemen departemen** & jabatan
- **Input absensi manual** oleh admin (koreksi data)
- **Verifikasi absensi** oleh admin/HR
- **Database SQLite** lengkap dengan 8+ tabel relasional
- **JWT Authentication** + role-based access (superadmin, admin)
- **Auto-deteksi terlambat** berdasarkan jadwal kerja

---

## 🗄️ Struktur Database

| Tabel | Fungsi |
|-------|--------|
| `perusahaan` | Data perusahaan |
| `departemen` | Departemen/divisi |
| `jabatan` | Jabatan karyawan |
| `karyawan` | Data lengkap karyawan |
| `users` | Akun login admin |
| `jadwal_kerja` | Jadwal & toleransi keterlambatan |
| `absensi` | **Data absensi + foto masuk/keluar** |
| `pengajuan_izin` | Pengajuan cuti/izin |
| `notifikasi` | Notifikasi sistem |

---

## 🚀 Cara Menjalankan

### 1. Prasyarat
- Node.js versi 16+ (https://nodejs.org)

### 2. Install dependencies
```bash
cd absensi-app
npm install
```

### 3. Jalankan server
```bash
npm start
```

### 4. Buka browser
```
http://localhost:3000
```

---

## 🔐 Akun Default

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Super Admin |
| `hrmanager` | `hr123` | Admin HR |

---

## 📁 Struktur Folder

```
absensi-app/
├── server.js              # Entry point Express.js
├── package.json           # Dependencies
├── db/
│   ├── database.js        # Inisialisasi & seed database
│   └── absensi.db         # File database SQLite (auto-dibuat)
├── routes/
│   ├── auth.js            # Login, register, ganti password
│   ├── auth.middleware.js # JWT middleware
│   ├── karyawan.js        # CRUD karyawan + upload foto profil
│   ├── absensi.js         # Absen masuk/keluar + dashboard stats
│   └── master.js          # Departemen, jabatan, laporan
└── public/
    ├── index.html         # Frontend SPA lengkap
    └── uploads/
        ├── profil/        # Foto profil karyawan
        └── absensi/       # Foto absensi (diorganisir per bulan)
```

---

## 📡 API Endpoints

### Auth
- `POST /api/auth/login` — Login
- `POST /api/auth/register` — Buat user baru
- `POST /api/auth/change-password` — Ganti password

### Karyawan
- `GET /api/karyawan` — Daftar karyawan (+ filter)
- `POST /api/karyawan` — Tambah karyawan (+ foto)
- `PUT /api/karyawan/:id` — Update karyawan
- `DELETE /api/karyawan/:id` — Nonaktifkan karyawan

### Absensi
- `POST /api/absensi/masuk` — **Absen masuk (foto wajib)**
- `POST /api/absensi/keluar` — **Absen keluar (foto wajib)**
- `GET /api/absensi/hari-ini` — Absensi hari ini
- `GET /api/absensi/dashboard/stats` — Statistik dashboard
- `GET /api/absensi?tanggal=...` — Rekap absensi (filter)
- `PUT /api/absensi/verifikasi/:id` — Verifikasi absensi
- `POST /api/absensi/manual` — Input manual (admin)

### Master
- `GET/POST/PUT/DELETE /api/departemen` — Manajemen departemen
- `GET/POST /api/jabatan` — Manajemen jabatan
- `GET /api/laporan/bulanan` — Laporan per bulan
- `GET /api/laporan/harian` — Laporan per hari

---

## 🛡️ Keamanan
- Password di-hash dengan **bcrypt**
- Autentikasi menggunakan **JWT** (8 jam expire)
- File upload dibatasi **10MB** per foto
- Hanya format **gambar** yang diterima untuk foto absensi

---

## 🔧 Konfigurasi

Edit file `server.js` untuk mengubah port:
```js
const PORT = process.env.PORT || 3000;
```

Edit `db/database.js` → `jadwal_kerja` untuk mengubah jam kerja dan toleransi keterlambatan.

---

## 📞 Teknologi yang Digunakan

- **Backend**: Node.js + Express.js
- **Database**: SQLite (via better-sqlite3)
- **Auth**: JWT + bcrypt
- **Upload**: Multer
- **Frontend**: HTML5 + CSS3 + Vanilla JS (SPA)
- **Font**: Plus Jakarta Sans + Space Mono
