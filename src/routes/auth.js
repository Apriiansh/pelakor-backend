const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

// Login Endpoint [POST /api/auth/login]
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body;

  // Validation
  if (!identifier || !password) {
    return res.status(400).json({ 
      success: false,
      message: 'NIK/email dan password wajib diisi.' 
    });
  }

  try {
    const client = await pool.connect();
    
    // Query user by NIK or email
    const query = 'SELECT * FROM users WHERE nik = $1 OR email = $1';
    const result = await client.query(query, [identifier]);
    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'User tidak ditemukan.' 
      });
    }

    const user = result.rows[0];
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        message: 'NIK/email atau password salah.' 
      });
    }

    // Create JWT token
    const tokenPayload = {
      nik: user.nik,
      nama: user.nama,
      email: user.email,
      role: user.role,
      id: user.id
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: '24h', // Extended to 24 hours
    });

    // Success response
    res.json({
      success: true,
      message: 'Login berhasil',
      token,
      user: tokenPayload,
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error saat login.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Test endpoint to verify auth routes are working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;