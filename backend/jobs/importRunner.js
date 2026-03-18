import fs from 'fs';
import { emitToOrg } from '../sockets/emitter.js';
import { invalidatePatterns, invalidationTargets } from '../utils/cache.js';
import { iterCsvRows, DEFAULT_MAX_IMPORT_ROWS } from './importUtils.js';
import logger from '../utils/logger.js';

const IMPORT_CHUNK_SIZE = 100;

function emitImportProgress({ organizationId, jobId, importType, done, total, created, failed, dryRun }) {
  emitToOrg(organizationId, 'import:progress', {
    jobId,
    importType,
    done,
    total,
    created,
    failed,
    dryRun,
  });
}

function buildImportResult({ importType, total, processed, created, failed, dryRun, errors, startTime }) {
  return {
    success: failed < processed,
    importType,
    total: total ?? processed,
    processed,
    created,
    failed,
    dryRun,
    errors,
    duration: `${Date.now() - startTime}ms`,
  };
}

function summarizeImportErrors(errors) {
  if (errors.length === 0) {
    return 'All rows failed during import';
  }
  return errors
    .slice(0, 3)
    .map(({ row, message }) => `row ${row}: ${message}`)
    .join('; ');
}

async function invalidateImportCaches(importType, organizationId) {
  const invalidationsByType = {
    warehouses: ['dash', 'analytics', 'inv:list', 'inv:stats', 'inv:lowstock'],
    products: ['dash', 'analytics', 'inv:list'],
    inventory: ['inv:list', 'inv:stats', 'inv:lowstock', 'dash', 'analytics'],
    orders: ['orders:list', 'dash', 'analytics'],
    shipments: ['ship:list', 'dash', 'analytics'],
    carriers: ['dash', 'analytics'],
    channels: ['dash', 'analytics'],
    suppliers: ['dash', 'analytics'],
    team: ['dash', 'analytics'],
  };

  const prefixes = invalidationsByType[importType] || ['dash', 'analytics'];
  await invalidatePatterns(invalidationTargets(organizationId, ...prefixes));
}

async function completeImport({ organizationId, jobId, importType, result, created, dryRun, failed }) {
  if (created === 0) {
    const errorSummary = summarizeImportErrors(result.errors);

    emitToOrg(organizationId, 'import:complete', {
      jobId,
      importType,
      ...result,
      errorMessage: errorSummary,
    });

    logger.error(`Import ${importType} failed`, {
      jobId,
      total: result.total,
      failed,
      dryRun,
      errorSummary,
    });
    throw new Error(errorSummary);
  }

  emitToOrg(organizationId, 'import:complete', { jobId, importType, ...result });

  if (!dryRun && created > 0) {
    await invalidateImportCaches(importType, organizationId);
  }

  logger.info(`Import ${importType} complete`, {
    jobId,
    total: result.total,
    created,
    failed,
    dryRun,
  });
}

/**
 * Shared import runner that streams rows, tracks row-level errors, emits socket
 * progress updates, and invalidates cache prefixes when successful.
 */
export async function runImport({
  jobId,
  organizationId,
  rows,
  filePath,
  importType,
  processRow,
  dryRun = false,
  maxRows = DEFAULT_MAX_IMPORT_ROWS,
}) {
  const startTime = Date.now();
  const useRows = Array.isArray(rows);
  const total = useRows ? rows.length : null;
  let created = 0;
  let failed = 0;
  const errors = [];
  let processed = 0;

  const sourceRows = useRows ? rows : iterCsvRows(filePath, maxRows);

  try {
    for await (const row of sourceRows) {
      processed++;
      try {
        await processRow(row, { dryRun });
        created++;
      } catch (err) {
        failed++;
        if (errors.length < 20) errors.push({ row: processed, message: err.message });
      }

      if (processed % IMPORT_CHUNK_SIZE === 0 || (total !== null && processed === total)) {
        emitImportProgress({
          organizationId,
          jobId,
          importType,
          done: processed,
          total,
          created,
          failed,
          dryRun,
        });
      }
    }

    const result = buildImportResult({
      importType,
      total,
      processed,
      created,
      failed,
      dryRun,
      errors,
      startTime,
    });

    await completeImport({
      organizationId,
      jobId,
      importType,
      result,
      created,
      dryRun,
      failed,
    });

    return result;
  } finally {
    if (!useRows && filePath) {
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // best-effort cleanup
      }
    }
  }
}
