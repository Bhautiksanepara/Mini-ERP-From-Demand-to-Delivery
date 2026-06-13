const { AppError } = require('../utils/app-error');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }));

      return next(new AppError('Validation failed', 400, errors));
    }

    req.body = result.data.body || req.body;
    req.params = result.data.params || req.params;
    req.query = result.data.query || req.query;

    return next();
  };
}

module.exports = {
  validate
};
