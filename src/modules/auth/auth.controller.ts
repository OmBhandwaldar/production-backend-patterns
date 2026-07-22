import type { CookieOptions, Request, Response } from "express";
import { env } from "../../config/env.js";
import { UnauthorizedError } from "../../lib/errors.js";
import { authService } from "./auth.service.js";
import { loginSchema } from "./auth.schema.js";

/**
 * AUTH CONTROLLER — HTTP translation for login / refresh / logout.
 *
 * TOKEN DELIVERY:
 *  - Access token  → JSON body. Client keeps it in MEMORY (not localStorage) and
 *    sends it as `Authorization: Bearer <token>`. Short-lived, so low risk.
 *  - Refresh token → httpOnly cookie (below). JS can't read it → XSS can't steal
 *    it. Browser auto-attaches it ONLY to /auth/* and only over HTTPS in prod.
 */

const REFRESH_COOKIE = "refreshToken";

// Shared attributes. To clear a cookie the browser must see the SAME
// httpOnly/secure/sameSite/path — a mismatch leaves the cookie in place. maxAge
// is added only when SETTING (clearCookie must not receive it).
function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true, // JS cannot read it (document.cookie hides it) → XSS-safe
    secure: env.NODE_ENV === "production", // HTTPS-only in prod; off on localhost http
    sameSite: "strict", // not sent on cross-site requests → CSRF defense
    path: "/auth", // browser sends it ONLY to /auth/refresh and /auth/logout
  };
}

function setCookieOptions(): CookieOptions {
  return { ...baseCookieOptions(), maxAge: env.JWT_REFRESH_TTL * 1000 };
}

export const authController = {
  async login(req: Request, res: Response) {
    const { email, password } = loginSchema.parse(req.body);
    const { accessToken, refreshToken, userId } = await authService.login(email, password);

    res.cookie(REFRESH_COOKIE, refreshToken, setCookieOptions());
    res.json({ accessToken, userId }); // refresh token is NOT in the body
  },

  async refresh(req: Request, res: Response) {
    // Read the refresh token from the cookie, never the body.
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!raw) throw new UnauthorizedError("missing refresh token");

    const { accessToken, refreshToken } = await authService.refresh(raw);

    // Rotation → set the NEW refresh cookie, return the NEW access token.
    res.cookie(REFRESH_COOKIE, refreshToken, setCookieOptions());
    res.json({ accessToken });
  },

  async logout(req: Request, res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (raw) await authService.logout(raw);

    // Clear the cookie (same attributes required for the browser to drop it).
    res.clearCookie(REFRESH_COOKIE, baseCookieOptions());
    res.status(204).send();
  },
};
