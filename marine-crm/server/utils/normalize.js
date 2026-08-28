/**
 * Normalizes a COC (Certificate of Competency) number.
 * - Converts to String
 * - Trims leading/trailing whitespace
 * - Converts to uppercase
 * Example: " ind12345 " -> "IND12345"
 */
function normalizeCoc(value) {
  if (!value || typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }
  return String(value).trim().toUpperCase();
}

module.exports = {
  normalizeCoc,
};
