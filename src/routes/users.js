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

// GET /api/users - Ambil semua user atau filter berdasarkan role (tanpa password)
router.get('/', async (req, res) => {
  try {
    const { role, jabatan } = req.query;
    const client = await pool.connect();
    
    let query = 'SELECT nama, nik, email, role, jabatan FROM users';
    let params = [];
    let conditions = [];
    
    if (role) {
      conditions.push(`role = $${conditions.length + 1}`);
      params.push(role);
    }
    
    if (jabatan) {
      conditions.push(`jabatan ILIKE $${conditions.length + 1}`);
      params.push(`%${jabatan}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY nama ASC';
    
    const result = await client.query(query, params);
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat pengguna', error: err.message });
  }
});

// GET /api/users/by-role/:role - Endpoint khusus untuk ambil user berdasarkan role
router.get('/by-role/:role', async (req, res) => {
  try {
    const { role } = req.params;
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT nama, nik, email, role, jabatan FROM users WHERE role = $1 ORDER BY nama ASC',
      [role]
    );
    
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat pengguna berdasarkan role', error: err.message });
  }
});

// GET /api/users/subbag-umum - Endpoint khusus untuk ambil daftar subbag umum
router.get('/subbag-umum', async (req, res) => {
  console.log('--- Endpoint /api/users/subbag-umum diakses ---');
  try {
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT nama, nik, email, role, jabatan FROM users WHERE role = $1 ORDER BY nama ASC',
      ['subbag_umum']
    );
    
    client.release();
    
    // console.log('Jumlah data subbag_umum yang ditemukan:', result.rowCount);
    // console.log('Data yang dikirim ke frontend:', result.rows);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error saat mengambil data subbag umum:', err);
    res.status(500).json({ message: 'Gagal memuat daftar subbag umum', error: err.message });
  }
});

// GET /api/users/kabbag - Endpoint khusus untuk ambil daftar kabbag
router.get('/kabbag', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT nama, nik, email, role, jabatan FROM users WHERE role = $1 ORDER BY nama ASC',
      ['kabbag']
    );
    
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat daftar kabbag', error: err.message });
  }
});

// GET /api/users/pegawai - Endpoint khusus untuk ambil daftar pegawai
router.get('/pegawai', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT nama, nik, email, role, jabatan FROM users WHERE role = $1 ORDER BY nama ASC',
      ['pegawai']
    );
    
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat daftar pegawai', error: err.message });
  }
});

// GET /api/users/bagian - Endpoint untuk mendapatkan daftar bagian yang tersedia
router.get('/bagian', async (req, res) => {
  try {
    const bagianList = [
      { id: 1, name: 'Bagian Tata Pemerintahan & Kerjasama', code: 'tapem' },
      { id: 2, name: 'Bagian Kesejahteraan Rakyat', code: 'kesra' },
      { id: 3, name: 'Bagian Hukum', code: 'hukum' },
      { id: 4, name: 'Bagian Perekonomian & Sumber Daya Alam', code: 'perekonomian' },
      { id: 5, name: 'Bagian Administrasi Pembangunan', code: 'adpem' },
      { id: 6, name: 'Bagian Pengadaian Barang & Jasa', code: 'pengadaan' },
      { id: 7, name: 'Bagian Umum', code: 'umum' },
      { id: 8, name: 'Bagian Organisasi', code: 'organisasi' },
      { id: 9, name: 'Bagian Protokol Komunikasi & Pimpinan', code: 'protokol' },
      { id: 10, name: 'Bagian Perencanaan & Keuangan', code: 'renkeu' }
    ];
    
    res.json(bagianList);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat daftar bagian', error: err.message });
  }
});

// GET /api/users/by-bagian/:bagian - Endpoint untuk ambil user berdasarkan bagian (jabatan)
router.get('/by-bagian/:bagian', async (req, res) => {
  try {
    const { bagian } = req.params;
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT nama, nik, email, role, jabatan FROM users WHERE jabatan ILIKE $1 ORDER BY nama ASC',
      [`%${bagian}%`]
    );
    
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat pengguna berdasarkan bagian', error: err.message });
  }
});

// GET /api/users/me - Ambil profil user yang sedang login
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT nama, nik, email, role, jabatan FROM users WHERE nik = $1',
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

// GET /api/users/:nik - Ambil detail user berdasarkan NIK
router.get('/:nik', async (req, res) => {
  try {
    const { nik } = req.params;
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT nama, nik, email, role, jabatan FROM users WHERE nik = $1',
      [nik]
    );
    
    client.release();
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengambil detail user', error: err.message });
  }
});

// POST /api/users - Tambah user baru
router.post('/', async (req, res) => {
  const { nama, nik, email, role, jabatan, password } = req.body;
  
  if (!nama || !nik || !email || !role || !password) {
    return res.status(400).json({ message: 'Nama, NIK, email, role, dan password wajib diisi' });
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
    
    const result = await client.query(
      'INSERT INTO users (nama, nik, email, role, jabatan, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING nama, nik, email, role, jabatan',
      [nama, nik, email, role, jabatan || null, hashed]
    );
    
    client.release();
    
    res.status(201).json({ 
      message: 'Pengguna berhasil disimpan',
      user: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menyimpan pengguna', error: err.message });
  }
});

// PUT /api/users/:nik - Edit user (kecuali NIK)
router.put('/:nik', async (req, res) => {
  const { nama, email, role, jabatan, password } = req.body;
  const { nik } = req.params;
  
  if (!nama || !email || !role) {
    return res.status(400).json({ message: 'Nama, email, dan role wajib diisi' });
  }
  
  try {
    const client = await pool.connect();
    
    // Cek apakah user exists
    const checkUser = await client.query('SELECT 1 FROM users WHERE nik = $1', [nik]);
    if (checkUser.rows.length === 0) {
      client.release();
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }
    
    let query, params;
    
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      query = 'UPDATE users SET nama=$1, email=$2, role=$3, jabatan=$4, password=$5 WHERE nik=$6 RETURNING nama, nik, email, role, jabatan';
      params = [nama, email, role, jabatan || null, hashed, nik];
    } else {
      query = 'UPDATE users SET nama=$1, email=$2, role=$3, jabatan=$4 WHERE nik=$5 RETURNING nama, nik, email, role, jabatan';
      params = [nama, email, role, jabatan || null, nik];
    }
    
    const result = await client.query(query, params);
    client.release();
    
    res.json({ 
      message: 'Pengguna berhasil diperbarui',
      user: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ message: 'Gagal memperbarui pengguna', error: err.message });
  }
});

// DELETE /api/users/:nik - Hapus user
router.delete('/:nik', async (req, res) => {
  const { nik } = req.params;
  
  try {
    const client = await pool.connect();
    
    // Cek apakah user memiliki laporan terkait
    const checkLaporan = await client.query('SELECT 1 FROM laporan WHERE nik_pelapor = $1 LIMIT 1', [nik]);
    
    if (checkLaporan.rows.length > 0) {
      client.release();
      return res.status(400).json({ 
        message: 'Tidak dapat menghapus pengguna yang memiliki laporan terkait' 
      });
    }
    
    const result = await client.query('DELETE FROM users WHERE nik = $1 RETURNING nama', [nik]);
    client.release();
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }
    
    res.json({ 
      message: 'Pengguna berhasil dihapus',
      deletedUser: result.rows[0].nama
    });
  } catch (err) {
    res.status(500).json({ message: 'Gagal menghapus pengguna', error: err.message });
  }
});

module.exports = router;