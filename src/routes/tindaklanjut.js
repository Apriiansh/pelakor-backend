const express = require('express');
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Konfigurasi multer untuk upload lampiran tindak lanjut
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'tindaklanjut');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/**
 * GET /api/tindaklanjut
 * Ambil daftar laporan yang menjadi tanggung jawab user (role Subbag Umum)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();

    // Subbag hanya melihat laporan yg status diproses
    const query = `
      SELECT l.id, l.judul_laporan, l.isi_laporan, l.status_laporan, l.created_at, u.nama as pelapor
      FROM laporan l
      JOIN users u ON u.nik = l.id_pelapor
      WHERE l.id_penanggung_jawab = $1
      ORDER BY l.created_at DESC
    `;
    const result = await client.query(query, [req.user.nik]);
    client.release();

    res.json(result.rows);
  } catch (err) {
    console.error('Error get tindak lanjut:', err);
    res.status(500).json({ message: 'Gagal memuat daftar tindak lanjut', error: err.message });
  }
});

/**
 * POST /api/tindaklanjut/:laporan_id
 * Tambahkan catatan tindak lanjut
 */
router.post('/:laporan_id', authenticateToken, upload.single('lampiran'), async (req, res) => {
  const { laporan_id } = req.params;
  const { catatan, status } = req.body; // status opsional: ditindaklanjuti / selesai
  const filePath = req.file ? `/uploads/tindaklanjut/${req.file.filename}` : null;

  try {
    const client = await pool.connect();

    // Masukkan ke log tindak lanjut
    const insertLog = `
      INSERT INTO tindak_lanjut (laporan_id, nik_penindak, catatan, lampiran, status_tindaklanjut)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const logResult = await client.query(insertLog, [
      laporan_id,
      req.user.nik,
      catatan || null,
      filePath,
      status || 'ditindaklanjuti',
    ]);

    // Update status laporan utama
    const updateLaporan = `
      UPDATE laporan SET status_laporan = $1, updated_at = NOW()
      WHERE id = $2
    `;
    await client.query(updateLaporan, [status || 'ditindaklanjuti', laporan_id]);

    client.release();
    res.status(201).json({
      message: 'Tindak lanjut berhasil dicatat',
      tindak_lanjut: logResult.rows[0],
    });
  } catch (err) {
    console.error('Error insert tindak lanjut:', err);
    res.status(500).json({ message: 'Gagal menyimpan tindak lanjut', error: err.message });
  }
});

/**
 * GET /api/tindaklanjut/:laporan_id
 * Ambil semua catatan tindak lanjut untuk laporan tertentu
 */
router.get('/:laporan_id', authenticateToken, async (req, res) => {
  const { laporan_id } = req.params;
  try {
    const client = await pool.connect();
    const query = `
      SELECT t.id, t.catatan, t.lampiran, t.status_tindaklanjut, t.created_at, u.nama AS penindak
      FROM tindak_lanjut t
      JOIN users u ON u.nik = t.nik_penindak
      WHERE t.laporan_id = $1
      ORDER BY t.created_at ASC
    `;
    const result = await client.query(query, [laporan_id]);
    client.release();

    res.json(result.rows);
  } catch (err) {
    console.error('Error get tindak lanjut by laporan:', err);
    res.status(500).json({ message: 'Gagal memuat catatan tindak lanjut', error: err.message });
  }
});

module.exports = router;
