function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
}

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;

  if (process.env.NODE_ENV !== 'test') {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    message: error.isOperational ? error.message : 'Internal server error',
    errors: error.errors || undefined
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
