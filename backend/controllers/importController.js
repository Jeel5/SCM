/**
 * Import Controller
 *
 * Accepts a multipart CSV upload, parses it in memory, and enqueues a
 * BullMQ job so the actual row-by-row processing happens asynchronously.
 * Progress is pushed to the client via Socket.IO (import:progress / import:complete).
 */
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { jobsService } from '../services/jobsService.js';
import { AppError, NotFoundError } from '../errors/index.js';
import { asyncHandler } from '../errors/errorHandler.js';

const importsDir = path.join(process.cwd(), 'tmp', 'imports');
fs.mkdirSync(importsDir, { recursive: true });

// ─── Multer disk storage (stream-friendly for large files) ───────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, importsDir),
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, '_');
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
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

const MAX_ROWS = 200_000;

function parseDryRunFlag(value) {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  return false;
}

async function countCsvRows(filePath, maxRows = MAX_ROWS) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let lines = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    lines++;
    if (lines - 1 > maxRows) {
      rl.close();
      stream.destroy();
      throw new AppError(`CSV too large: more than ${maxRows} data rows`, 400);
    }
  }

  if (lines < 2) return 0;
  return lines - 1; // minus header row
}

// ─── POST /import/upload ──────────────────────────────────────────────────────
export const startImport = asyncHandler(async (req, res) => {
  const { type } = req.body;
  const dryRun = parseDryRunFlag(req.body?.dryRun);

  if (!IMPORT_TYPES[type]) {
    throw new AppError(
      `Unknown import type: "${type}". Must be one of: ${Object.keys(IMPORT_TYPES).join(', ')}`,
      400
    );
  }

  if (!req.file) throw new AppError('No file uploaded', 400);

  const totalRows = await countCsvRows(req.file.path, MAX_ROWS);
  if (!totalRows) throw new AppError('CSV file is empty or has no data rows', 400);

  const organizationId = req.orgContext?.organizationId || req.user?.organizationId;
  const userId         = req.user?.userId;

  const job = await jobsService.createJob(
    IMPORT_TYPES[type],
    {
      filePath: req.file.path,
      originalFileName: req.file.originalname,
      organizationId,
      importedBy: userId,
      importType: type,
      dryRun,
      maxRows: MAX_ROWS,
    },
    dryRun ? 4 : 5,
    null, // scheduledFor
    userId
  );

  res.json({
    success:   true,
    jobId:     job.id,
    totalRows,
    dryRun,
    message:   `${dryRun ? 'Dry-run validation' : 'Import'} queued — ${totalRows} rows will be processed in the background.`,
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

function parseCsv(_text) {
  return [];
}
