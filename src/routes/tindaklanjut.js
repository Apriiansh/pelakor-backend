const express = require('express');
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Konfigurasi multer untuk upload lampiran
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

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipe file tidak diizinkan. Hanya JPEG, PNG, dan PDF yang diperbolehkan.'));
    }
  }
});

/**
 * GET /api/tindaklanjut
 * Ambil daftar laporan yang menjadi tanggung jawab user (role Subbag Umum)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'subbag_umum') {
      return res.status(403).json({ message: 'Akses ditolak, hanya Subbag Umum yang dapat mengakses' });
    }

    const client = await pool.connect();
    const query = `
      SELECT 
        l.id_laporan, l.judul_laporan, l.isi_laporan, l.kategori, l.status_laporan, 
        l.created_at, l.updated_at, l.nik_pelapor, u.nama as pelapor,
        d.catatan_disposisi, d.created_at as tanggal_disposisi,
        k.nama as kabbag_umum
      FROM laporan l
      JOIN users u ON u.nik = l.nik_pelapor
      JOIN disposisi d ON d.id_laporan = l.id_laporan
      JOIN users k ON k.nik = d.nik_kabbag
      WHERE d.nik_penanggung_jawab = $1 
        AND l.status_laporan IN ('diproses', 'ditindaklanjuti')
      ORDER BY l.created_at ASC
    `;
    const result = await client.query(query, [req.user.nik]);
    client.release();

    res.json(result.rows);
  } catch (err) {
    console.error('Error get tindak lanjut list:', err);
    res.status(500).json({ message: 'Gagal memuat daftar tindak lanjut', error: err.message });
  }
});

/**
 * POST /api/tindaklanjut/:id_laporan
 * Tambahkan catatan tindak lanjut dengan lampiran opsional
 */
router.post('/:id_laporan', authenticateToken, upload.single('lampiran'), async (req, res) => {
  const { id_laporan } = req.params;
  const { catatan_tindak_lanjut, status } = req.body;
  const lampiran = req.file ? `/uploads/tindaklanjut/${req.file.filename}` : null;

  const client = await pool.connect();
  try {
    if (req.user.role !== 'subbag_umum') {
      return res.status(403).json({ message: 'Akses ditolak, hanya Subbag Umum yang dapat menindaklanjuti' });
    }

    await client.query('BEGIN');

    // Validasi bahwa laporan ini memang tanggung jawab user
    const checkQuery = `
      SELECT d.id_disposisi FROM disposisi d
      WHERE d.id_laporan = $1 AND d.nik_penanggung_jawab = $2
    `;
    const checkResult = await client.query(checkQuery, [id_laporan, req.user.nik]);
    
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Laporan ini bukan tanggung jawab Anda' });
    }

    // Insert tindak lanjut
    const insertQuery = `
      INSERT INTO tindak_lanjut (id_laporan, nik_subbag, catatan_tindak_lanjut, status_tindak_lanjut, lampiran)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const tindakLanjutResult = await client.query(insertQuery, [
      id_laporan,
      req.user.nik,
      catatan_tindak_lanjut || null,
      status || 'ditindaklanjuti',
      lampiran
    ]);

    // Update status laporan
    const newStatus = status || 'ditindaklanjuti';
    const updateLaporanQuery = `
      UPDATE laporan SET status_laporan = $1, updated_at = NOW()
      WHERE id_laporan = $2
    `;
    await client.query(updateLaporanQuery, [newStatus, id_laporan]);

    // Insert status history
    const keteranganHistory = `Tindak lanjut: ${catatan_tindak_lanjut || 'Tanpa catatan'}`;
    await client.query(
      `INSERT INTO status_history (id_laporan, status, keterangan, changed_by) VALUES ($1, $2, $3, $4)`,
      [id_laporan, newStatus, keteranganHistory, req.user.nik]
    );

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Tindak lanjut berhasil disimpan',
      tindak_lanjut: tindakLanjutResult.rows[0],
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
 * GET /api/tindaklanjut/:id_laporan
 * Ambil semua catatan tindak lanjut untuk laporan tertentu
 */
router.get('/:id_laporan', authenticateToken, async (req, res) => {
  const { id_laporan } = req.params;
  try {
    const client = await pool.connect();
    const query = `
      SELECT 
        t.id_tindak_lanjut, t.catatan_tindak_lanjut, t.status_tindak_lanjut, 
        t.lampiran, t.created_at, t.updated_at,
        u.nama AS penindak, u.jabatan
      FROM tindak_lanjut t
      JOIN users u ON u.nik = t.nik_subbag
      WHERE t.id_laporan = $1
      ORDER BY t.created_at ASC
    `;
    const result = await client.query(query, [id_laporan]);
    client.release();

    res.json(result.rows);
  } catch (err) {
    console.error('Error get tindak lanjut history:', err);
    res.status(500).json({ message: 'Gagal memuat histori tindak lanjut', error: err.message });
  }
});

/**
 * PUT /api/tindaklanjut/:id_tindak_lanjut
 * Update catatan tindak lanjut
 */
router.put('/:id_tindak_lanjut', authenticateToken, upload.single('lampiran'), async (req, res) => {
  const { id_tindak_lanjut } = req.params;
  const { catatan_tindak_lanjut, status } = req.body;
  const lampiran = req.file ? `/uploads/tindaklanjut/${req.file.filename}` : null;

  const client = await pool.connect();
  try {
    if (req.user.role !== 'subbag_umum') {
      return res.status(403).json({ message: 'Akses ditolak, hanya Subbag Umum yang dapat mengupdate' });
    }

    await client.query('BEGIN');

    // Validasi bahwa tindak lanjut ini milik user
    const checkQuery = `
      SELECT t.id_laporan, t.lampiran FROM tindak_lanjut t
      WHERE t.id_tindak_lanjut = $1 AND t.nik_subbag = $2
    `;
    const checkResult = await client.query(checkQuery, [id_tindak_lanjut, req.user.nik]);
    
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Tindak lanjut ini bukan milik Anda' });
    }

    const oldData = checkResult.rows[0];

    // Update tindak lanjut
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (catatan_tindak_lanjut !== undefined) {
      updateFields.push(`catatan_tindak_lanjut = $${paramIndex}`);
      updateValues.push(catatan_tindak_lanjut);
      paramIndex++;
    }

    if (status !== undefined) {
      updateFields.push(`status_tindak_lanjut = $${paramIndex}`);
      updateValues.push(status);
      paramIndex++;
    }

    if (lampiran) {
      updateFields.push(`lampiran = $${paramIndex}`);
      updateValues.push(lampiran);
      paramIndex++;
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(id_tindak_lanjut);

    const updateQuery = `
      UPDATE tindak_lanjut 
      SET ${updateFields.join(', ')}
      WHERE id_tindak_lanjut = $${paramIndex}
      RETURNING *
    `;
    const updateResult = await client.query(updateQuery, updateValues);

    // Update status laporan jika status berubah
    if (status) {
      const updateLaporanQuery = `
        UPDATE laporan SET status_laporan = $1, updated_at = NOW()
        WHERE id_laporan = $2
      `;
      await client.query(updateLaporanQuery, [status, oldData.id_laporan]);

      // Insert status history
      const keteranganHistory = `Update tindak lanjut: ${catatan_tindak_lanjut || 'Status diperbarui'}`;
      await client.query(
        `INSERT INTO status_history (id_laporan, status, keterangan, changed_by) VALUES ($1, $2, $3, $4)`,
        [oldData.id_laporan, status, keteranganHistory, req.user.nik]
      );
    }

    // Hapus file lama jika ada file baru
    if (lampiran && oldData.lampiran) {
      try {
        await fs.unlink(path.join(__dirname, '..', oldData.lampiran));
      } catch (error) {
        console.error('Error deleting old file:', error);
      }
    }

    await client.query('COMMIT');
    res.json({
      message: 'Tindak lanjut berhasil diperbarui',
      tindak_lanjut: updateResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error update tindak lanjut:', err);
    res.status(500).json({ message: 'Gagal memperbarui tindak lanjut', error: err.message });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/tindaklanjut/:id_tindak_lanjut
 * Hapus catatan tindak lanjut
 */
router.delete('/:id_tindak_lanjut', authenticateToken, async (req, res) => {
  const { id_tindak_lanjut } = req.params;

  const client = await pool.connect();
  try {
    if (req.user.role !== 'subbag_umum') {
      return res.status(403).json({ message: 'Akses ditolak, hanya Subbag Umum yang dapat menghapus' });
    }

    await client.query('BEGIN');

    // Validasi dan ambil data
    const checkQuery = `
      SELECT t.lampiran FROM tindak_lanjut t
      WHERE t.id_tindak_lanjut = $1 AND t.nik_subbag = $2
    `;
    const checkResult = await client.query(checkQuery, [id_tindak_lanjut, req.user.nik]);
    
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Tindak lanjut ini bukan milik Anda' });
    }

    const oldData = checkResult.rows[0];

    // Hapus record
    const deleteQuery = `DELETE FROM tindak_lanjut WHERE id_tindak_lanjut = $1`;
    await client.query(deleteQuery, [id_tindak_lanjut]);

    // Hapus file jika ada
    if (oldData.lampiran) {
      try {
        await fs.unlink(path.join(__dirname, '..', oldData.lampiran));
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Tindak lanjut berhasil dihapus' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error delete tindak lanjut:', err);
    res.status(500).json({ message: 'Gagal menghapus tindak lanjut', error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;