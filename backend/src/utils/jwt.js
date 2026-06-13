const jwt = require('jsonwebtoken');
const { AppError } = require('./app-error');

function getJwtSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret || secret === 'replace_with_a_long_random_secret') {
    throw new AppError('JWT_ACCESS_SECRET is not configured', 500);
  }

  return secret;
}

function signAccessToken(user) {
  const roles = (user.roles || []).map((role) => role.code);

  return jwt.sign(
    {
      sub: String(user.id),
      login_id: user.login_id,
      email: user.email,
      roles
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1d'
    }
  );
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    throw new AppError('Invalid or expired authentication token', 401);
  }
}

module.exports = {
  signAccessToken,
  verifyAccessToken
};
