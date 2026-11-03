import pino from 'pino';
import { pinoHttp } from 'pino-http';
import crypto from 'node:crypto';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.isProduction ? 'info' : 'debug',
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', 'body.token', 'body.csrfToken'],
    censor: '[REDACTED]',
  },
  transport: !config.isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => {
    const existing = req.headers['x-request-id'];
    if (existing && typeof existing === 'string') {
      return existing;
    }
    const id = crypto.randomUUID();
    return id;
  },
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
  customErrorMessage: (req, _res, err) => `${req.method} ${req.url} failed: ${err.message}`,
});
