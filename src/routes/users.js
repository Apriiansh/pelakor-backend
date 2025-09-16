const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware autentikasi JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// GET /api/users - Ambil semua user (tanpa password)
router.get('/', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT nama, nik, email, role FROM users ORDER BY nama ASC');
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat pengguna', error: err.message });
  }
});

// GET /api/users/me - Ambil profil user yang sedang login
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT nama, nik, email, role FROM users WHERE nik = $1',
      [req.user.nik]
    );
    client.release();
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil profil', error: err.message });
  }
});

// POST /api/users - Tambah user baru
router.post('/', async (req, res) => {
  const { nama, nik, email, role, password } = req.body;
  if (!nama || !nik || !email || !role || !password) {
    return res.status(400).json({ message: 'Semua field wajib diisi' });
  }
  try {
    const client = await pool.connect();
    // Cek duplikat NIK/email
    const cek = await client.query('SELECT 1 FROM users WHERE nik = $1 OR email = $2', [nik, email]);
    if (cek.rows.length > 0) {
      client.release();
      return res.status(409).json({ message: 'NIK atau email sudah terdaftar' });
    }
    const hashed = await bcrypt.hash(password, 10);
    await client.query(
      'INSERT INTO users (nama, nik, email, role, password) VALUES ($1, $2, $3, $4, $5)',
      [nama, nik, email, role, hashed]
    );
    client.release();
    res.status(201).json({ message: 'Pengguna berhasil disimpan' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menyimpan pengguna', error: err.message });
  }
});

// PUT /api/users/:nik - Edit user (kecuali NIK)
router.put('/:nik', async (req, res) => {
  const { nama, email, role, password } = req.body;
  const { nik } = req.params;
  if (!nama || !email || !role) {
    return res.status(400).json({ message: 'Nama, email, dan role wajib diisi' });
  }
  try {
    const client = await pool.connect();
    let query, params;
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      query = 'UPDATE users SET nama=$1, email=$2, role=$3, password=$4 WHERE nik=$5';
      params = [nama, email, role, hashed, nik];
    } else {
      query = 'UPDATE users SET nama=$1, email=$2, role=$3 WHERE nik=$4';
      params = [nama, email, role, nik];
    }
    const result = await client.query(query, params);
    client.release();
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }
    res.json({ message: 'Pengguna berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal memperbarui pengguna', error: err.message });
  }
});

// DELETE /api/users/:nik - Hapus user
router.delete('/:nik', async (req, res) => {
  const { nik } = req.params;
  try {
    const client = await pool.connect();
    const result = await client.query('DELETE FROM users WHERE nik = $1', [nik]);
    client.release();
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }
    res.json({ message: 'Pengguna berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menghapus pengguna', error: err.message });
  }
});

module.exports = router;