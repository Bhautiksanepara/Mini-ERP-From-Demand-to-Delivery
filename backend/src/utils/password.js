const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  comparePassword,
  hashPassword
};
