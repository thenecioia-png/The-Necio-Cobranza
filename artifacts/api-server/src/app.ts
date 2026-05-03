import express, { type Express } from "express";
import cors from "cors";
import cookieSession from "cookie-session";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const isProduction = process.env.NODE_ENV === "production";

const app: Express = express();

// Trust reverse proxy so secure cookies work over HTTPS
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
// Middleware personalizado para parsear JSON (evita WAF que elimina comillas)
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json') || contentType.includes('text/plain')) {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        req.body = data ? JSON.parse(data) : {};
      } catch (e) {
        // Intentar reparar JSON sin comillas (WAF damage): {a:"b"} → {"a":"b"}
        try {
          const fixed = data.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
          req.body = fixed ? JSON.parse(fixed) : {};
        } catch {
          req.body = {};
        }
      }
      next();
    });
  } else {
    next();
  }
});
app.use(express.urlencoded({ extended: true }));

app.use(
  cookieSession({
    name: "necio_session",
    secret: process.env.SESSION_SECRET || "necio-secret-key-2024",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
    httpOnly: true,
    secure: isProduction,
  })
);

app.use("/api", router);

// Serve React frontend in production
const frontendDist = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : path.resolve(__dirname, "../../necio-app/dist/public");

if (isProduction && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
