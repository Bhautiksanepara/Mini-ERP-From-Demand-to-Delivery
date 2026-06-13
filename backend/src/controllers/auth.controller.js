const authModel = require('../models/auth.model');
const userModel = require('../models/user.model');
const { asyncHandler } = require('../utils/async-handler');
const { AppError } = require('../utils/app-error');
const { comparePassword, hashPassword } = require('../utils/password');
const { signAccessToken } = require('../utils/jwt');
const { toPublicUser } = require('../utils/user-presenter');

const signup = asyncHandler(async (req, res) => {
  const existingUser = await userModel.findByLoginIdOrEmail(req.body.login_id, req.body.email);

  if (existingUser) {
    throw new AppError('Login ID or email already exists', 409);
  }

  const requestedRoleCodes = req.body.role_codes || [];

  if (requestedRoleCodes.includes('admin') && process.env.ALLOW_ADMIN_SIGNUP !== 'true') {
    throw new AppError('Admin signup is disabled', 403);
  }

  const passwordHash = await hashPassword(req.body.password);
  const user = await authModel.createUserWithRoles({
    ...req.body,
    password_hash: passwordHash,
    role_codes: requestedRoleCodes
  });

  const accessToken = signAccessToken(user);

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: {
      user: toPublicUser(user),
      access_token: accessToken
    }
  });
});

const login = asyncHandler(async (req, res) => {
  const user = await userModel.findByLoginIdentifier(req.body.login_id);

  if (!user || user.deleted_at || !user.is_active) {
    throw new AppError('Invalid Login Id or Password', 401);
  }

  const isPasswordValid = await comparePassword(req.body.password, user.password_hash);

  if (!isPasswordValid) {
    throw new AppError('Invalid Login Id or Password', 401);
  }

  const roles = await userModel.findRolesByUserId(user.id);
  const userWithRoles = { ...user, roles };
  const accessToken = signAccessToken(userWithRoles);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: toPublicUser(userWithRoles),
      access_token: accessToken
    }
  });
});

const me = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);

  if (!user || user.deleted_at || !user.is_active) {
    throw new AppError('User account is not active', 401);
  }

  const roles = await userModel.findRolesByUserId(user.id);

  res.json({
    success: true,
    data: {
      user: toPublicUser({ ...user, roles })
    }
  });
});

module.exports = {
  signup,
  login,
  me
};
