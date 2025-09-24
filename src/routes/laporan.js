const express = require('express');
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Konfigurasi multer untuk upload lampiran laporan
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'laporan');
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
 * POST /api/laporan
 * Buat laporan baru (pelapor)
 */
router.post('/', authenticateToken, upload.single('lampiran'), async (req, res) => {
  const { judul_laporan, isi_laporan, kategori } = req.body;
  const filePath = req.file ? `/uploads/laporan/${req.file.filename}` : null;

  if (!judul_laporan || !isi_laporan) {
    return res.status(400).json({ message: 'judul_laporan dan isi_laporan wajib diisi' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const insertQuery = `
      INSERT INTO laporan (judul_laporan, isi_laporan, kategori, lampiran, status_laporan, nip_pelapor, created_at)
      VALUES ($1, $2, $3, $4, 'diajukan', $5, NOW()) RETURNING *
    `;
    const result = await client.query(insertQuery, [
      judul_laporan,
      isi_laporan,
      kategori || null,
      filePath,
      req.user.nip,
    ]);
    const laporan = result.rows[0];

    // Insert status_history
    await client.query(
      `INSERT INTO status_history (id_laporan, status, keterangan, changed_by) VALUES ($1, $2, $3, $4)`,
      [laporan.id_laporan, 'diajukan', 'Laporan baru dibuat', req.user.nip]
    );

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Laporan berhasil dibuat',
      laporan: laporan,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error create laporan:', err);
    res.status(500).json({ message: 'Gagal membuat laporan', error: err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/laporan/selesai
 * Ambil daftar laporan yang statusnya "selesai"
 * PENTING: Route ini harus didefinisikan SEBELUM route /:id_laporan
 */
router.get('/selesai', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    let query, params;

    // Role check: 
    // - Pelapor: hanya laporan miliknya yang selesai
    // - Kabbag/Admin: semua laporan selesai
    // - Subbag: laporan selesai yang pernah jadi tanggung jawabnya
    if (req.user.role === 'pelapor') {
      query = `
        SELECT l.*, u.nama AS pelapor
        FROM laporan l
        JOIN users u ON u.nip = l.nip_pelapor
        WHERE l.nip_pelapor = $1 AND l.status_laporan = 'selesai'
        ORDER BY l.updated_at DESC NULLS LAST
      `;
      params = [req.user.nip];
    } else if (req.user.role === 'subbag_umum') {
      query = `
        SELECT l.*, u.nama AS pelapor
        FROM laporan l
        JOIN users u ON u.nip = l.nip_pelapor
        WHERE l.status_laporan = 'selesai'
        AND l.id_laporan IN (
          SELECT DISTINCT id_laporan
          FROM tindak_lanjut
          WHERE nip_subbag = $1
        )
        ORDER BY l.updated_at DESC NULLS LAST
      `;
      params = [req.user.nip];
    } else {
      // kabbag_umum / admin
      query = `
        SELECT l.*, u.nama AS pelapor
        FROM laporan l
        JOIN users u ON u.nip = l.nip_pelapor
        WHERE l.status_laporan = 'selesai'
        ORDER BY l.updated_at DESC NULLS LAST
      `;
      params = [];
    }

    const result = await client.query(query, params);
    client.release();

    res.json(result.rows);
  } catch (err) {
    console.error('Error get laporan selesai:', err);
    res.status(500).json({ message: 'Gagal memuat laporan selesai', error: err.message });
  }
});

/**
 * GET /api/laporan
 * Ambil daftar laporan sesuai role
 * - Pelapor: hanya laporan miliknya
 * - Kabbag: semua laporan
 * - Subbag: laporan yang jadi tanggung jawabnya (tindak lanjut terakhir oleh subbag tsb)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    let query, params;

    if (req.user.role === 'pelapor') {
      query = `
        SELECT l.*, u.nama AS pelapor
        FROM laporan l
        JOIN users u ON u.nip = l.nip_pelapor
        WHERE l.nip_pelapor = $1
        ORDER BY l.created_at DESC
      `;
      params = [req.user.nip];
    } else if (req.user.role === 'subbag_umum') {
      // Ambil laporan di mana tindak lanjut terakhir oleh user subbag ini
      query = `
        SELECT l.*, u.nama AS pelapor
        FROM laporan l
        JOIN users u ON u.nip = l.nip_pelapor
        WHERE l.id_laporan IN (
          SELECT t1.id_laporan
          FROM tindak_lanjut t1
          INNER JOIN (
            SELECT id_laporan, MAX(created_at) AS max_created
            FROM tindak_lanjut
            GROUP BY id_laporan
          ) t2 ON t1.id_laporan = t2.id_laporan AND t1.created_at = t2.max_created
          WHERE t1.nip_subbag = $1
        )
        ORDER BY l.created_at DESC
      `;
      params = [req.user.nip];
    } else {
      // Kabbag & admin bisa lihat semua
      query = `
        SELECT l.*, u.nama AS pelapor
        FROM laporan l
        JOIN users u ON u.nip = l.nip_pelapor
        ORDER BY l.created_at DESC
      `;
      params = [];
    }

    const result = await client.query(query, params);
    client.release();
    res.json(result.rows);
  } catch (err) {
    console.error('Error get laporan:', err);
    res.status(500).json({ message: 'Gagal memuat laporan', error: err.message });
  }
});

/**
 * GET /api/laporan/:id_laporan
 * Detail laporan
 */
router.get('/:id_laporan', authenticateToken, async (req, res) => {
  const { id_laporan } = req.params;
  try {
    const client = await pool.connect();
    const query = `
      SELECT l.*, u.nama AS pelapor
      FROM laporan l
      JOIN users u ON u.nip = l.nip_pelapor
      WHERE l.id_laporan = $1
    `;
    const result = await client.query(query, [id_laporan]);
    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Laporan tidak ditemukan' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error get laporan detail:', err);
    res.status(500).json({ message: 'Gagal memuat detail laporan', error: err.message });
  }
});

/**
 * PUT /api/laporan/:id_laporan
 * Edit laporan (hanya jika status masih diajukan)
 */
router.put('/:id_laporan', authenticateToken, upload.single('lampiran'), async (req, res) => {
  const { id_laporan } = req.params;
  const { judul_laporan, isi_laporan, kategori } = req.body;
  const filePath = req.file ? `/uploads/laporan/${req.file.filename}` : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cek status laporan
    const check = await client.query('SELECT * FROM laporan WHERE id_laporan = $1 AND nip_pelapor = $2', [
      id_laporan,
      req.user.nip,
    ]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ message: 'Laporan tidak ditemukan atau bukan milik Anda' });
    }
    if (check.rows[0].status_laporan !== 'diajukan') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ message: 'Laporan hanya bisa diedit jika status masih diajukan' });
    }

    // Update laporan
    const updateQuery = `
      UPDATE laporan
      SET judul_laporan=$1, isi_laporan=$2, kategori=$3, lampiran=COALESCE($4, lampiran), updated_at=NOW()
      WHERE id_laporan=$5 RETURNING *
    `;
    const result = await client.query(updateQuery, [
      judul_laporan,
      isi_laporan,
      kategori || null,
      filePath,
      id_laporan,
    ]);
    const updated = result.rows[0];

    // Jika ingin log update ke status_history (opsional, status tetap "diajukan")
    await client.query(
      `INSERT INTO status_history (id_laporan, status, keterangan, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [id_laporan, 'diajukan', 'Laporan diperbarui oleh pelapor', req.user.nip]
    );

    await client.query('COMMIT');
    res.json({
      message: 'Laporan berhasil diperbarui',
      laporan: updated,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error update laporan:', err);
    res.status(500).json({ message: 'Gagal memperbarui laporan', error: err.message });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/laporan/:id_laporan
 * Hapus laporan (hanya jika status masih diajukan)
 */
router.delete('/:id_laporan', authenticateToken, async (req, res) => {
  const { id_laporan } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cek status laporan
    const check = await client.query('SELECT * FROM laporan WHERE id_laporan = $1 AND nip_pelapor = $2', [
      id_laporan,
      req.user.nip,
    ]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ message: 'Laporan tidak ditemukan atau bukan milik Anda' });
    }
    if (check.rows[0].status_laporan !== 'diajukan') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ message: 'Laporan hanya bisa dihapus jika status masih diajukan' });
    }

    // (Opsional) Insert status_history sebelum hapus
    await client.query(
      `INSERT INTO status_history (id_laporan, status, keterangan, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [id_laporan, 'dihapus', 'Laporan dihapus oleh pelapor', req.user.nip]
    );

    await client.query('DELETE FROM laporan WHERE id_laporan=$1', [id_laporan]);
    await client.query('COMMIT');

    res.json({ message: 'Laporan berhasil dihapus' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error delete laporan:', err);
    res.status(500).json({ message: 'Gagal menghapus laporan', error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;