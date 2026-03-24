import express, { type Express } from "express";
import cors from "cors";
import cookieSession from "cookie-session";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cookieSession({
    name: "necio_session",
    secret: process.env.SESSION_SECRET || "necio-secret-key-2024",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
    httpOnly: true,
  })
);

app.use("/api", router);

export default app;
