const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/disposisi
 * Ambil daftar laporan dengan status "diajukan"
 * (hanya bisa diakses oleh Kabbag Umum)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'kabbag') {
      return res.status(403).json({ message: 'Akses ditolak, hanya Kabbag yang bisa disposisi' });
    }

    const client = await pool.connect();
    const query = `
      SELECT l.id, l.judul_laporan, l.isi_laporan, l.status_laporan, l.created_at, u.nama as pelapor
      FROM laporan l
      JOIN users u ON u.nik = l.id_pelapor
      WHERE l.status_laporan = 'diajukan'
      ORDER BY l.created_at ASC
    `;
    const result = await client.query(query);
    client.release();

    res.json(result.rows);
  } catch (err) {
    console.error('Error get disposisi list:', err);
    res.status(500).json({ message: 'Gagal memuat laporan untuk disposisi', error: err.message });
  }
});

/**
 * POST /api/disposisi/:laporan_id
 * Lakukan disposisi laporan ke unit/pegawai (id_penanggung_jawab)
 */
router.post('/:laporan_id', authenticateToken, async (req, res) => {
  const { laporan_id } = req.params;
  const { nik_penanggung_jawab, catatan, valid } = req.body; 
  // valid = true → diproses, valid = false → ditolak

  try {
    if (req.user.role !== 'kabbag') {
      return res.status(403).json({ message: 'Akses ditolak, hanya Kabbag yang bisa disposisi' });
    }

    const client = await pool.connect();

    let statusLaporan = 'ditolak';
    if (valid) {
      statusLaporan = 'diproses';
    }

    // Catat disposisi
    const insertLog = `
      INSERT INTO disposisi (laporan_id, nik_kabbag, nik_penanggung_jawab, catatan, status_disposisi)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const logResult = await client.query(insertLog, [
      laporan_id,
      req.user.nik,
      valid ? nik_penanggung_jawab : null,
      catatan || null,
      statusLaporan,
    ]);

    // Update laporan utama
    const updateLaporan = `
      UPDATE laporan SET status_laporan = $1, id_penanggung_jawab = $2, updated_at = NOW()
      WHERE id = $3
    `;
    await client.query(updateLaporan, [
      statusLaporan,
      valid ? nik_penanggung_jawab : null,
      laporan_id,
    ]);

    client.release();
    res.status(201).json({
      message: 'Disposisi berhasil dicatat',
      disposisi: logResult.rows[0],
    });
  } catch (err) {
    console.error('Error insert disposisi:', err);
    res.status(500).json({ message: 'Gagal menyimpan disposisi', error: err.message });
  }
});

/**
 * GET /api/disposisi/:laporan_id
 * Ambil histori disposisi untuk laporan tertentu
 */
router.get('/:laporan_id', authenticateToken, async (req, res) => {
  const { laporan_id } = req.params;
  try {
    const client = await pool.connect();
    const query = `
      SELECT d.id, d.catatan, d.status_disposisi, d.created_at, 
             u.nama AS kabbag, p.nama AS penanggung_jawab
      FROM disposisi d
      JOIN users u ON u.nik = d.nik_kabbag
      LEFT JOIN users p ON p.nik = d.nik_penanggung_jawab
      WHERE d.laporan_id = $1
      ORDER BY d.created_at ASC
    `;
    const result = await client.query(query, [laporan_id]);
    client.release();

    res.json(result.rows);
  } catch (err) {
    console.error('Error get disposisi history:', err);
    res.status(500).json({ message: 'Gagal memuat histori disposisi', error: err.message });
  }
});

module.exports = router;
