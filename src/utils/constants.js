module.exports = {
  STATUS_CODES: {
    SUCCESS: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
  },
  ERROR_MESSAGES: {
    INTERNAL_SERVER_ERROR: 'Internal server error',
    UNAUTHORIZED: 'Unauthorized access',
    NOT_FOUND: 'Resource not found',
  },
  ROLES: {
    USER: 'user',
    ADMIN: 'admin',
    WORKER: 'worker',
    EMPLOYER: 'employer'
  },
  PROVIDERS: {
    LOCAL: 'local',
    GOOGLE: 'google',
  },
};
