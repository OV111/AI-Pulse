import type { Request, Response, NextFunction, RequestHandler } from "express";

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
};

type WindowState = {
  count: number;
  windowStartedAt: number;
};

const requestWindows = new Map<string, WindowState>();

function getClientKey(req: Request): string {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    const [first] = forwardedFor.split(",");
    return first.trim();
  }

  return req.ip || req.socket.remoteAddress || "unknown";
}

export function createRateLimitMiddleware(
  options: RateLimitOptions,
): RequestHandler {
  const { windowMs, maxRequests } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = getClientKey(req);
    const now = Date.now();
    const current = requestWindows.get(key);

    if (!current || now - current.windowStartedAt >= windowMs) {
      requestWindows.set(key, { count: 1, windowStartedAt: now });
      return next();
    }

    if (current.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil(
        (windowMs - (now - current.windowStartedAt)) / 1000,
      );
      res.setHeader("Retry-After", String(Math.max(retryAfterSeconds, 1)));
      return res.status(429).json({
        error: `Rate limit exceeded. Max ${maxRequests} requests per minute.`,
      });
    }

    current.count += 1;
    requestWindows.set(key, current);
    return next();
  };
}
