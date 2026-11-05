declare module "*.js" {
  import type { Request, Response } from "express";

  export function createApp(): (
    req: Request,
    res: Response
  ) => void;
}
declare module "*.js" {
  import type { Express } from "express";

  export function createApp(): Express;
}