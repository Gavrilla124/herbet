const jwt = require('jsonwebtoken');
const SECRET = 'absensi_secret_key_2024';

function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1] || req.session?.token;
  if (!token) return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Token tidak valid' });
  }
}

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: '8h' });
}

module.exports = { authMiddleware, generateToken, SECRET };
