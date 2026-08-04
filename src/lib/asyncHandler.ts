import type { NextFunction, Request, Response } from "express";

/**
 * Express 4 does NOT catch rejections from async handlers — a thrown error in
 * an `async (req,res) => {...}` returns a REJECTED PROMISE that Express never
 * awaits, so the request hangs forever. This higher-order function wraps a
 * handler and attaches `.catch(next)`, forwarding any thrown/rejected error to
 * the central error-handling middleware. Lets controllers just `throw` and
 * stay focused on the happy path. 
 * (Express 5 handles this natively; this remains the standard Express-4 idiom.)
 */

//.catch(next) = .catch(err => next(err))
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
