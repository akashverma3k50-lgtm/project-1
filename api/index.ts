import type { Request, Response } from 'express';

let appInstance: ((req: Request, res: Response) => void) | null = null;

async function getApp(): Promise<(req: Request, res: Response) => void> {
  if (appInstance) return appInstance;

  try {
    const distModule = await import('../dist/app.js');
    appInstance = distModule.createApp();
    return appInstance!;
  } catch {
    const srcModule = await import('../src/app.js');
    appInstance = srcModule.createApp();
    return appInstance!;
  }
}

export default async function handler(req: Request, res: Response): Promise<void> {
  const app = await getApp();
  app(req, res);
}
