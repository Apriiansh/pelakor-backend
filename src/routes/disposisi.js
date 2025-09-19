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
    if (req.user.role !== 'kabbag_umum') {
      return res.status(403).json({ message: 'Akses ditolak, hanya Kabbag yang bisa disposisi' });
    }

    const client = await pool.connect();
    const query = `
      SELECT l.id_laporan, l.judul_laporan, l.isi_laporan, l.status_laporan, l.created_at, l.nik_pelapor, u.nama as pelapor
      FROM laporan l
      JOIN users u ON u.nik = l.nik_pelapor
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
 * POST /api/disposisi/:id_laporan
 * Lakukan disposisi laporan ke Sub Bagian Umum (id_penanggung_jawab)
 */
router.post('/:id_laporan', authenticateToken, async (req, res) => {
  const { id_laporan } = req.params;
  const { nik_penanggung_jawab, catatan_disposisi, valid } = req.body;
  // valid = true → diproses, valid = false → ditolak

  const client = await pool.connect();
  try {
    if (req.user.role !== 'kabbag_umum') {
      return res.status(403).json({ message: 'Akses ditolak, hanya Kabbag yang bisa disposisi' });
    }

    await client.query('BEGIN');

    const statusLaporan = valid ? 'diproses' : 'ditolak';
    const keteranganHistory = valid
      ? `Laporan didisposisikan kepada penanggung jawab.`
      : 'Laporan ditolak oleh Kabbag.';

    // Catat disposisi
    const insertLog = `
      INSERT INTO disposisi (id_laporan, nik_kabbag, nik_penanggung_jawab, catatan_disposisi, status_disposisi)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const logResult = await client.query(insertLog, [
      id_laporan,
      req.user.nik,
      valid ? nik_penanggung_jawab : null,
      catatan_disposisi || null,
      statusLaporan,
    ]);

    // Update laporan utama
    const updateLaporan = `
      UPDATE laporan SET status_laporan = $1, updated_at = NOW()
      WHERE id_laporan = $2
    `;
    await client.query(updateLaporan, [
      statusLaporan,
      id_laporan,
    ]);

    // Insert status_history
    await client.query(
      `INSERT INTO status_history (id_laporan, status, keterangan, changed_by) VALUES ($1, $2, $3, $4)`,
      [id_laporan, statusLaporan, keteranganHistory, req.user.nik]
    );

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Disposisi berhasil dicatat',
      disposisi: logResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error insert disposisi:', err);
    res.status(500).json({ message: 'Gagal menyimpan disposisi', error: err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/disposisi/:id_laporan
 * Ambil histori disposisi untuk laporan tertentu
 */
router.get('/:id_laporan', authenticateToken, async (req, res) => {
  const { id_laporan } = req.params;
  try {
    const client = await pool.connect();
    const query = `
      SELECT d.id_disposisi, d.catatan_disposisi, d.status_disposisi, d.created_at, 
             u.nama AS kabbag_umum, p.nama AS penanggung_jawab
      FROM disposisi d
      JOIN users u ON u.nik = d.nik_kabbag
      LEFT JOIN users p ON p.nik = d.nik_penanggung_jawab
      WHERE d.id_laporan = $1
      ORDER BY d.created_at ASC
    `;
    const result = await client.query(query, [id_laporan]);
    client.release();

    res.json(result.rows);
  } catch (err) {
    console.error('Error get disposisi history:', err);
    res.status(500).json({ message: 'Gagal memuat histori disposisi', error: err.message });
  }
});

module.exports = router;
