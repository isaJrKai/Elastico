import { Response, NextFunction } from "express";
import { db, ApiLog } from "./db";
import { AuthenticatedRequest } from "./auth";

/**
 * Custom middleware writing logs dynamically to our persistent DB state
 */
export function requestLogger(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    try {
      const duration = Date.now() - start;
      const logId = db.api_logs.length > 0 ? Math.max(...db.api_logs.map((o) => o.id)) + 1 : 1;

      const newLog: ApiLog = {
        id: logId,
        user_id: req.user?.id || null,
        endpoint: req.baseUrl + req.path,
        method: req.method,
        status: res.statusCode,
        ip: (req.ip || req.socket?.remoteAddress || "127.0.0.1"),
        user_agent: req.get("user-agent") || "Anonymous Client",
        duration_ms: duration,
        created_at: new Date().toISOString(),
      };

      db.api_logs.push(newLog);
      db.save();
    } catch (e) {
      // Handle silently, never crash the core Express loop on metrics failures
    }
  });

  next();
}
