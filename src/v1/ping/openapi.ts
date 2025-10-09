import { PingResponseSchema } from '../../schemas';

export default {
  method: 'get' as const,
  path: '/ping',
  operationId: 'ping',
  summary: 'Health check',
  description: 'Check if the service is running',
  tags: ['System'],
  responses: {
    200: {
      description: 'Service is running',
      content: {
        'application/json': {
          schema: PingResponseSchema
        }
      }
    }
  }
};
