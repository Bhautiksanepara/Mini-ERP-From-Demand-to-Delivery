const { pool } = require('../config/database');
const { AppError } = require('./app-error');

function formatReference(prefix, nextNumber, paddingLength) {
  return `${prefix}${String(nextNumber).padStart(paddingLength, '0')}`;
}

async function generateReference(sequenceCode, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT code, prefix, next_number, padding_length
     FROM reference_sequences
     WHERE code = ?
     FOR UPDATE`,
    [sequenceCode]
  );

  const sequence = rows[0];

  if (!sequence) {
    throw new AppError(`Reference sequence "${sequenceCode}" is not configured`, 500);
  }

  const reference = formatReference(
    sequence.prefix,
    sequence.next_number,
    sequence.padding_length
  );

  await connection.execute(
    `UPDATE reference_sequences
     SET next_number = next_number + 1
     WHERE code = ?`,
    [sequenceCode]
  );

  return reference;
}

module.exports = {
  formatReference,
  generateReference
};
