/**
 * Auto-generate internal barcode for warehouse operations.
 * Format: IB{YYYYMMDD}{HHMMSS}{random_4}
 * Example: IB202403011530129A4B
 * 
 * Guaranteed unique via:
 * - Date+time precision (second-level)
 * - Random suffix
 * - Database UNIQUE constraint (retry on collision)
 */
export function generateInternalBarcode() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');  // HHMMSS
  const random = Math.random().toString(36).slice(2, 6).toUpperCase(); // 4 chars
  
  return `IB${date}${time}${random}`;
}

/**
 * Validate generic barcode format (8-20 alphanumeric characters)
 */
export function isValidBarcode(barcode) {
  if (!barcode) return true; // nullable field
  return /^[A-Z0-9]{8,20}$/i.test(barcode);
}
