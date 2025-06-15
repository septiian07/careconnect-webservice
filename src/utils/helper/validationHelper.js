function formatFieldName(fieldName) {
  const withSpaces = fieldName.replace(/([A-Z])/g, ' $1');
  return withSpaces.charAt(0).toLowerCase() + withSpaces.slice(1);
}

/**
 * Memvalidasi field-field yang wajib diisi dalam sebuah objek.
 * @param {object} data - Objek yang akan divalidasi (misal: req.body).
 * @param {string[]} requiredFields - Array berisi nama-nama field yang wajib diisi.
 * @returns {string|null} Mengembalikan pesan error jika ada field yang kosong, atau null jika semua valid.
 */
function validateRequiredFields(data, requiredFields) {
  for (const field of requiredFields) {
    // Cek jika field tidak ada, null, undefined, atau string kosong
    if (!data[field]) {
      const friendlyName = formatFieldName(field);
      return `${friendlyName} is required.`;
    }
  }
  return null;
}

module.exports = {
  validateRequiredFields,
};