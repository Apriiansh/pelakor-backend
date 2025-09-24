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
    
    let query = 'SELECT nama, nip, email, role, jabatan, unit_kerja, created_at FROM users';
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
      'SELECT nama, nip, email, role, jabatan, unit_kerja, created_at FROM users WHERE role = $1 ORDER BY nama ASC',
      [role]
    );
    
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat pengguna berdasarkan role', error: err.message });
  }
});

// GET /api/users/bupati - Endpoint khusus untuk ambil daftar bupati
router.get('/bupati', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT nama, nip, email, role, jabatan, unit_kerja, created_at FROM users WHERE role = $1 ORDER BY nama ASC',
      ['bupati']
    );
    
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat daftar bupati', error: err.message });
  }
});

// GET /api/users/wakil-bupati - Endpoint khusus untuk ambil daftar wakil bupati
router.get('/wakil-bupati', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT nama, nip, email, role, jabatan, unit_kerja, created_at FROM users WHERE role = $1 ORDER BY nama ASC',
      ['wakil_bupati']
    );
    
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat daftar wakil bupati', error: err.message });
  }
});

// GET /api/users/asisten - Endpoint khusus untuk ambil daftar asisten
router.get('/asisten', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT nama, nip, email, role, jabatan, unit_kerja, created_at FROM users WHERE role = $1 ORDER BY nama ASC',
      ['asisten']
    );
    
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat daftar asisten', error: err.message });
  }
});

// GET /api/users/staf-ahli - Endpoint khusus untuk ambil daftar staf ahli
router.get('/staf-ahli', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT nama, nip, email, role, jabatan, unit_kerja, created_at FROM users WHERE role = $1 ORDER BY nama ASC',
      ['staf_ahli']
    );
    
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat daftar staf ahli', error: err.message });
  }
});

// GET /api/users/kabbag-umum - Endpoint khusus untuk ambil daftar kabbag umum
router.get('/kabbag-umum', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT nama, nip, email, role, jabatan, unit_kerja, created_at FROM users WHERE role = $1 ORDER BY nama ASC',
      ['kabbag_umum']
    );
    
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat daftar kabbag umum', error: err.message });
  }
});

// GET /api/users/subbag-umum - Endpoint khusus untuk ambil daftar subbag umum
router.get('/subbag-umum', async (req, res) => {
  console.log('--- Endpoint /api/users/subbag-umum diakses ---');
  try {
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT nama, nip, email, role, jabatan, unit_kerja, created_at FROM users WHERE role = $1 ORDER BY nama ASC',
      ['subbag_umum']
    );
    
    client.release();
    
    console.log('Jumlah data subbag_umum yang ditemukan:', result.rowCount);
    console.log('Data yang dikirim ke frontend:', result.rows);
    
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
      'SELECT nama, nip, email, role, jabatan, unit_kerja, created_at FROM users WHERE role = $1 ORDER BY nama ASC',
      ['kabbag']
    );
    
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat daftar kabbag', error: err.message });
  }
});

// GET /api/users/pelapor - Endpoint khusus untuk ambil daftar pelapor
router.get('/pelapor', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT nama, nip, email, role, jabatan, unit_kerja, created_at FROM users WHERE role = $1 ORDER BY nama ASC',
      ['pelapor']
    );
    
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat daftar pelapor', error: err.message });
  }
});

// GET /api/users/opd - Endpoint khusus untuk ambil daftar opd
router.get('/opd', async (req, res) => {
  try {
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT nama, nip, email, role, jabatan, unit_kerja, created_at FROM users WHERE role = $1 ORDER BY nama ASC',
      ['opd']
    );
    
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Gagal memuat daftar opd', error: err.message });
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
      { id: 6, name: 'Bagian Pengadaan Barang & Jasa', code: 'pengadaan' },
      { id: 7, name: 'Bagian Umum', code: 'umum' },
      { id: 8, name: 'Bagian Organisasi', code: 'organisasi' },
      { id: 9, name: 'Bagian Protokol Komunipasi & Pimpinan', code: 'protokol' },
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
      'SELECT nama, nip, email, role, jabatan, unit_kerja, created_at FROM users WHERE jabatan ILIKE $1 ORDER BY nama ASC',
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
      'SELECT nama, nip, email, role, jabatan, unit_kerja, created_at FROM users WHERE nip = $1',
      [req.user.nip]
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

// GET /api/users/:nip - Ambil detail user berdasarkan NIP
router.get('/:nip', async (req, res) => {
  try {
    const { nip } = req.params;
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT nama, nip, email, role, jabatan, unit_kerja, created_at FROM users WHERE nip = $1',
      [nip]
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
  const { nama, nip, email, role, jabatan, unit_kerja, password } = req.body;
  
  // Validasi input
  if (!nama || !nip || !email || !role || !password) {
    return res.status(400).json({ message: 'Nama, NIP, email, role, dan password wajib diisi' });
  }

  // Validasi role
  const validRoles = ['bupati', 'wakil_bupati', 'asisten', 'staf_ahli', 'kabbag_umum', 'subbag_umum', 'kabbag', 'pelapor', 'pelapor'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Role tidak valid' });
  }
  
  try {
    const client = await pool.connect();
    
    // Di endpoint POST /api/users, tambahkan sebelum validasi:
    console.log('Received data:', req.body);
    console.log('Data types:', {
        nama: typeof req.body.nama,
        nip: typeof req.body.nip,
        email: typeof req.body.email,
        role: typeof req.body.role,
        jabatan: typeof req.body.jabatan,
        unit_kerja: typeof req.body.unit_kerja,
        password: typeof req.body.password
    });

    // Cek duplikat NIP/email
    const cek = await client.query('SELECT 1 FROM users WHERE nip = $1 OR email = $2', [nip, email]);
    if (cek.rows.length > 0) {
      client.release();
      return res.status(409).json({ message: 'NIP atau email sudah terdaftar' });
    }
    
    const hashed = await bcrypt.hash(password, 10);
    
    const result = await client.query(
      'INSERT INTO users (nama, nip, email, role, jabatan, unit_kerja, password) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING nama, nip, email, role, jabatan, unit_kerja, created_at', 
      [nama, nip, email, role, jabatan, unit_kerja || null, hashed]
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

// PUT /api/users/:nip - Edit user (kecuali NIP)
router.put('/:nip', async (req, res) => {
  const { nama, email, role, jabatan, unit_kerja, password } = req.body;
  const { nip } = req.params;
  
  // Validasi input
  if (!nama || !email || !role) {
    return res.status(400).json({ message: 'Nama, email, dan role wajib diisi' });
  }

  // Validasi role
  const validRoles = ['bupati', 'wakil_bupati', 'asisten', 'staf_ahli', 'kabbag_umum', 'subbag_umum', 'kabbag', 'pelapor', 'opd', 'pelapor'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Role tidak valid' });
  }
  
  try {
    const client = await pool.connect();
    
    // Cek apakah user exists
    const checkUser = await client.query('SELECT 1 FROM users WHERE nip = $1', [nip]);
    if (checkUser.rows.length === 0) {
      client.release();
      return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    }
    
    let query, params;
    
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      query = 'UPDATE users SET nama=$1, email=$2, role=$3, jabatan=$4, unit_kerja=$5, password=$6 WHERE nip=$7 RETURNING nama, nip, email, role, jabatan, unit_kerja, created_at';
      params = [nama, email, role, jabatan, unit_kerja || null, hashed, nip];
    } else {
      query = 'UPDATE users SET nama=$1, email=$2, role=$3, jabatan=$4, unit_kerja=$5 WHERE nip=$6 RETURNING nama, nip, email, role, jabatan, unit_kerja, created_at';
      params = [nama, email, role, jabatan, unit_kerja || null, nip];
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

// DELETE /api/users/:nip - Hapus user
router.delete('/:nip', async (req, res) => {
  const { nip } = req.params;
  
  try {
    const client = await pool.connect();
    
    // Cek apakah user memiliki laporan terkait
    const checkLaporan = await client.query('SELECT 1 FROM laporan WHERE nip_pelapor = $1 LIMIT 1', [nip]);
    
    if (checkLaporan.rows.length > 0) {
      client.release();
      return res.status(400).json({ 
        message: 'Tidak dapat menghapus pengguna yang memiliki laporan terkait' 
      });
    }
    
    const result = await client.query('DELETE FROM users WHERE nip = $1 RETURNING nama', [nip]);
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