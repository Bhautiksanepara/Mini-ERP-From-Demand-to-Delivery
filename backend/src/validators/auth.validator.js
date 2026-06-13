const { z } = require('zod');

const passwordSchema = z
  .string()
  .min(9, 'Password must be more than 8 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const signupSchema = z.object({
  body: z.object({
    login_id: z
      .string()
      .trim()
      .min(6, 'Login ID must be at least 6 characters')
      .max(12, 'Login ID must be at most 12 characters')
      .regex(/^[A-Za-z0-9_]+$/, 'Login ID can only contain letters, numbers, and underscore'),
    email: z.string().trim().email('Email ID must be valid').toLowerCase(),
    password: passwordSchema,
    full_name: z.string().trim().min(2, 'Name is required').max(120),
    address: z.string().trim().max(255).optional(),
    mobile_number: z.string().trim().max(20).optional(),
    position: z.string().trim().max(100).optional(),
    role_codes: z.array(z.string().trim().min(1)).optional()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const loginSchema = z.object({
  body: z.object({
    login_id: z.string().trim().min(1, 'Login ID is required'),
    password: z.string().min(1, 'Password is required')
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

module.exports = {
  loginSchema,
  signupSchema
};
