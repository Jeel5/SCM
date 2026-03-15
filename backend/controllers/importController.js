/**
 * Import Controller
 *
 * Accepts a multipart CSV upload, parses it in memory, and enqueues a
 * BullMQ job so the actual row-by-row processing happens asynchronously.
 * Progress is pushed to the client via Socket.IO (import:progress / import:complete).
 */
import multer from 'multer';
import { jobsService } from '../services/jobsService.js';
import { AppError, NotFoundError } from '../errors/index.js';
import { asyncHandler } from '../errors/errorHandler.js';

// ─── Multer in-memory storage (≤ 10 MB) ──────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new AppError('Only CSV files are accepted', 400));
    }
  },
});

export const uploadMiddleware = upload.single('file');

// Supported import types → job type names
const IMPORT_TYPES = {
  warehouses:  'import:warehouses',
  carriers:    'import:carriers',
  suppliers:   'import:suppliers',
  channels:    'import:channels',
  team:        'import:team',
  products:    'import:products',
  inventory:   'import:inventory',
  orders:      'import:orders',
  shipments:   'import:shipments',
};

const MAX_ROWS = 10_000;

// ─── POST /import/upload ──────────────────────────────────────────────────────
export const startImport = asyncHandler(async (req, res) => {
  const { type } = req.body;

  if (!IMPORT_TYPES[type]) {
    throw new AppError(
      `Unknown import type: "${type}". Must be one of: ${Object.keys(IMPORT_TYPES).join(', ')}`,
      400
    );
  }

  if (!req.file) throw new AppError('No file uploaded', 400);

  const csvText = req.file.buffer.toString('utf8');
  const rows = parseCsv(csvText);

  if (!rows.length) throw new AppError('CSV file is empty or has no data rows', 400);
  if (rows.length > MAX_ROWS) {
    throw new AppError(`CSV too large: ${rows.length} rows (max ${MAX_ROWS})`, 400);
  }

  const organizationId = req.orgContext?.organizationId || req.user?.organizationId;
  const userId         = req.user?.userId;

  const job = await jobsService.createJob(
    IMPORT_TYPES[type],
    { rows, organizationId, importedBy: userId, importType: type },
    5,    // priority
    null, // scheduledFor
    userId
  );

  res.json({
    success:   true,
    jobId:     job.id,
    totalRows: rows.length,
    message:   `Import queued — ${rows.length} rows will be processed in the background.`,
  });
});

// ─── GET /import/jobs/:jobId ───────────────────────────────────────────────────
export const getImportJobStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const organizationId = req.orgContext?.organizationId || req.user?.organizationId;

  const job = await jobsService.getJobById(jobId, organizationId);
  if (!job) throw new NotFoundError('Import job');

  res.json({
    success: true,
    job: {
      id:          job.id,
      status:      job.status,
      result:      job.result,
      error:       job.error_message,
      createdAt:   job.created_at,
      completedAt: job.completed_at,
    },
  });
});

// ─── CSV parser (quote-aware, handles commas inside quoted fields) ─────────────
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Strip BOM
  let headerLine = lines[0];
  if (headerLine.charCodeAt(0) === 0xfeff) headerLine = headerLine.slice(1);

  const headers = parseCsvLine(headerLine).map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim();
    });
    if (Object.values(row).every((v) => !v)) continue; // skip blank rows
    rows.push(row);
  }

  return rows;
}
