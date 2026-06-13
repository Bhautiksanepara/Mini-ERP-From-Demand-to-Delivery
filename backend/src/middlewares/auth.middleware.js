const userModel = require('../models/user.model');
const { AppError } = require('../utils/app-error');
const { asyncHandler } = require('../utils/async-handler');
const { verifyAccessToken } = require('../utils/jwt');

const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication token is required', 401);
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyAccessToken(token);
  const user = await userModel.findById(payload.sub);

  if (!user || user.deleted_at || !user.is_active) {
    throw new AppError('User account is not active', 401);
  }

  req.user = {
    id: Number(user.id),
    login_id: user.login_id,
    email: user.email,
    roles: Array.isArray(payload.roles) ? payload.roles : []
  };

  next();
});

module.exports = {
  authenticate
};
