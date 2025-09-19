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

    // Subbag hanya melihat laporan yg status diproses dan ditugaskan padanya
    const query = `
      SELECT l.id_laporan, l.judul_laporan, l.isi_laporan, l.status_laporan, l.created_at, u.nama as pelapor
      FROM laporan l
      JOIN users u ON u.nik = l.nik_pelapor
      JOIN (
          -- Find the latest disposisi for each laporan
          SELECT d1.*
          FROM disposisi d1
          INNER JOIN (
              SELECT id_laporan, MAX(created_at) AS max_created
              FROM disposisi
              GROUP BY id_laporan
          ) d2 ON d1.id_laporan = d2.id_laporan AND d1.created_at = d2.max_created
      ) d ON d.id_laporan = l.id_laporan
      WHERE l.status_laporan = 'diproses'
      AND d.nik_penanggung_jawab = $1
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
 * POST /api/tindaklanjut/:id_laporan
 * Tambahkan catatan tindak lanjut
 */
router.post('/:id_laporan', authenticateToken, upload.single('lampiran'), async (req, res) => {
  const { id_laporan } = req.params;
  const { catatan, status } = req.body; // status opsional: ditindaklanjuti / selesai
  const filePath = req.file ? `/uploads/tindaklanjut/${req.file.filename}` : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const statusLaporan = status || 'ditindaklanjuti';
    const keteranganHistory = status === 'selesai'
        ? 'Laporan telah selesai ditindaklanjuti.'
        : 'Laporan sedang dalam proses tindak lanjut.';

    // Masukkan ke log tindak lanjut
    const insertLog = `
      INSERT INTO tindak_lanjut (id_laporan, nik_subbag, catatan, lampiran, status_tindaklanjut)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const logResult = await client.query(insertLog, [
      id_laporan,
      req.user.nik,
      catatan || null,
      filePath,
      statusLaporan,
    ]);

    // Update status laporan utama
    const updateLaporan = `
      UPDATE laporan SET status_laporan = $1, updated_at = NOW()
      WHERE id_laporan = $2
    `;
    await client.query(updateLaporan, [statusLaporan, id_laporan]);

    // Insert status_history
    await client.query(
      `INSERT INTO status_history (id_laporan, status, keterangan, changed_by) VALUES ($1, $2, $3, $4)`,
      [id_laporan, statusLaporan, keteranganHistory, req.user.nik]
    );

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Tindak lanjut berhasil dicatat',
      tindak_lanjut: logResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error insert tindak lanjut:', err);
    res.status(500).json({ message: 'Gagal menyimpan tindak lanjut', error: err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/tindaklanjut/:id_laporanl_id
 * Ambil semua catatan tindak lanjut untuk laporan tertentu
 */
router.get('/:id_laporan', authenticateToken, async (req, res) => {
  const { id_laporan } = req.params;
  try {
    const client = await pool.connect();
    const query = `
      SELECT t.id_tindak_lanjut, t.catatan_tindak_lanjut, t.lampiran, t.status_tindak_lanjut, t.created_at, u.nama AS penindak
      FROM tindak_lanjut t
      JOIN users u ON u.nik = t.nik_subbag
      WHERE t.id_laporan = $1
      ORDER BY t.created_at ASC
    `;
    const result = await client.query(query, [id_laporan]);
    client.release();

    res.json(result.rows);
  } catch (err) {
    console.error('Error get tindak lanjut by laporan:', err);
    res.status(500).json({ message: 'Gagal memuat catatan tindak lanjut', error: err.message });
  }
});

module.exports = router;
