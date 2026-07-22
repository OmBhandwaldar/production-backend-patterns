/**
 * Augment Express's Request type so `req.user` is known to TypeScript across the
 * app. Populated by the `authenticate` middleware after verifying the access JWT.
 * Optional because unauthenticated routes (login/refresh) have no user.
 */
declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export {};
