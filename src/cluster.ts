import cluster from 'node:cluster';
import os from 'node:os';
import { logger } from './logger/index.js';

if (cluster.isPrimary) {
  const numCPUs = Math.max(1, Math.min(os.cpus().length, 8)); // Scale up to 8 cores or CPU limit
  logger.info({ primaryPid: process.pid, workers: numCPUs }, '⚡ Primary cluster manager starting');

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    logger.info({ workerId: worker.id, pid: worker.process.pid }, 'Spawned worker process');
  }

  // Auto-healing / auto-scaling: If a worker process exits, replace it immediately
  cluster.on('exit', (worker, code, signal) => {
    logger.warn(
      {
        workerId: worker.id,
        pid: worker.process.pid,
        code,
        signal,
      },
      'Worker died unexpectedly. Spawning replacement worker...',
    );
    const newWorker = cluster.fork();
    logger.info({ newWorkerId: newWorker.id, pid: newWorker.process.pid }, 'Replacement worker online');
  });

  // Graceful rolling reload on SIGUSR2
  process.on('SIGUSR2', () => {
    logger.info('Received SIGUSR2: Rolling cluster reload initiated');
    const workers = Object.values(cluster.workers || {});
    const restartNextWorker = (index: number) => {
      if (index >= workers.length) return;
      const worker = workers[index];
      if (!worker) return;

      worker.on('disconnect', () => {
        logger.info({ workerId: worker.id }, 'Worker disconnected, spawning fresh replacement');
        cluster.fork();
        restartNextWorker(index + 1);
      });
      worker.disconnect();
    };
    restartNextWorker(0);
  });
} else {
  // Worker process: import and run server
  import('./server.js').catch((err) => {
    logger.fatal({ err, workerPid: process.pid }, 'Failed to start worker server');
    process.exit(1);
  });
}
