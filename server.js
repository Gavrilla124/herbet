const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'absensi_session_2024', resave: false, saveUninitialized: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/karyawan', require('./routes/karyawan'));
app.use('/api/absensi', require('./routes/absensi'));
app.use('/api', require('./routes/master'));

// Serve SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🏢 ===================================`);
  console.log(`   SISTEM ABSENSI KARYAWAN`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`===================================`);
  console.log(`\n📋 Login Default:`);
  console.log(`   SuperAdmin: admin / admin123`);
  console.log(`   HR Manager: hrmanager / hr123`);
  console.log(`\n✅ Server berjalan di port ${PORT}\n`);
});
