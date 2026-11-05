import app from './app.js';
import { config } from './config/index.js';
import { logger } from './logger/index.js';
import { closeDatabase, getDatabase } from './database/db.js';

export { app };

// Only start HTTP listener and process traps in standalone server mode (not serverless / Vercel)
if (!config.isVercel) {
  try {
    // Initialize database schema eagerly
    getDatabase();
  } catch (err) {
    logger.warn({ err }, 'Eager database initialization failed on startup');
  }

  const server = app.listen(config.port, config.host, () => {
    logger.info(
      {
        port: config.port,
        host: config.host,
        env: config.env,
        pid: process.pid,
      },
      `🚀 Server running at http://${config.host}:${config.port}`,
    );
  });

  // Graceful shutdown handler
  const gracefulShutdown = (signal: string) => {
    logger.info({ signal }, 'Graceful shutdown initiated. Closing server...');

    server.close(() => {
      logger.info('HTTP server closed.');
      try {
        closeDatabase();
        logger.info('Database connections closed cleanly.');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error closing database on shutdown');
        process.exit(1);
      }
    });

    // Force close after 10 seconds if hanging
    setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded. Forcing exit.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Fatal Uncaught Exception');
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Fatal Unhandled Rejection');
    gracefulShutdown('unhandledRejection');
  });
}

export default app;
