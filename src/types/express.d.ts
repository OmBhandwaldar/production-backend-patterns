/**
 * Augment Express's Request type so `req.user` is known to TypeScript across the
 * app. Populated by the `authenticate` middleware after verifying the access JWT.
 * Optional because unauthenticated routes (login/refresh) have no user.
 */
declare global {
  namespace Express {
    interface Request {
      // Set by `authenticate` from the verified JWT claims (stateless).
      //  - role: coarse role name (A of the A+B split); may be null.
      //  - ver:  token's tokenVersion, checked against the user's current value
      //          in `authorize` for instant revocation.
      user?: { id: string; role: string | null; ver: number };
    }
  }
}

export {};
