export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Real-Time Chat & Notification API',
    version: '1.0.0',
    description:
      'REST API for authentication, conversations, messages, notifications, and ops. Real-time events use Socket.IO.',
  },
  servers: [{ url: '/api' }],
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'name', 'password'],
                properties: {
                  email: { type: 'string' },
                  name: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'OK' } },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Current user',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/conversations': {
      get: {
        summary: 'List conversations',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        summary: 'Create conversation',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Created' } },
      },
    },
    '/conversations/{id}/messages': {
      get: {
        summary: 'Paginated messages (cursor)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/messages': {
      post: {
        summary: 'Send message',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Created' } },
      },
    },
    '/health': {
      get: { summary: 'Health check', responses: { '200': { description: 'OK' } } },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};
