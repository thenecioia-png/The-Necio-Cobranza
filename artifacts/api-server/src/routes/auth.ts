import { Router, type IRouter } from "express";
import { db, usersTable, businessesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import crypto from "crypto";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as GitHubStrategy } from "passport-github2";
import { OAuth2Client } from "google-auth-library";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

declare module "express-serve-static-core" {
  interface Request {
    session?: { userId?: number };
  }
}

function mapUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    businessId: user.businessId ?? undefined,
  };
}

// Generate a unique username from a name or email
async function generateUsername(base: string): Promise<string> {
  const slug = base.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "user";
  let username = slug;
  let attempt = 0;
  while (true) {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);
    if (existing.length === 0) return username;
    attempt++;
    username = `${slug}${attempt}`;
  }
}

// Find or create user from OAuth
async function findOrCreateOAuthUser(
  provider: string,
  oauthId: string,
  profile: { name: string; email?: string; avatarUrl?: string }
) {
  // Try to find by provider + id
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.oauthProvider, provider), eq(usersTable.oauthId, oauthId)))
    .limit(1);

  if (existing) return existing;

  // Try to find by email if provided
  if (profile.email) {
    const [byEmail] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, profile.email))
      .limit(1);
    if (byEmail) {
      // Link OAuth to existing account
      const [updated] = await db
        .update(usersTable)
        .set({ oauthProvider: provider, oauthId, avatarUrl: profile.avatarUrl ?? null })
        .where(eq(usersTable.id, byEmail.id))
        .returning();
      return updated;
    }
  }

  // Create new business + user
  const [business] = await db.insert(businessesTable).values({
    name: `${profile.name}'s Negocio`,
    planType: "basic",
  }).returning();

  const username = await generateUsername(profile.email?.split("@")[0] || profile.name);

  const [user] = await db.insert(usersTable).values({
    username,
    name: profile.name,
    email: profile.email ?? null,
    oauthProvider: provider,
    oauthId,
    avatarUrl: profile.avatarUrl ?? null,
    role: "admin",
    businessId: business.id,
  }).returning();

  return user;
}

// --- Passport strategies ---

const baseUrl = process.env.NODE_ENV === "production"
  ? `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`
  : `https://${process.env.REPLIT_DEV_DOMAIN}`;

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${baseUrl}/api/auth/google/callback`,
      scope: ["profile", "email"],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const avatarUrl = profile.photos?.[0]?.value;
        const user = await findOrCreateOAuthUser("google", profile.id, {
          name: profile.displayName || "Usuario",
          email,
          avatarUrl,
        });
        done(null, user);
      } catch (err) {
        done(err as Error);
      }
    }
  ));
}

if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: `${baseUrl}/api/auth/facebook/callback`,
      profileFields: ["id", "displayName", "emails", "photos"],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const avatarUrl = profile.photos?.[0]?.value;
        const user = await findOrCreateOAuthUser("facebook", profile.id, {
          name: profile.displayName || "Usuario",
          email,
          avatarUrl,
        });
        done(null, user);
      } catch (err) {
        done(err as Error);
      }
    }
  ));
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${baseUrl}/api/auth/github/callback`,
    },
    async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
      try {
        const email = profile.emails?.[0]?.value;
        const avatarUrl = profile.photos?.[0]?.value;
        const user = await findOrCreateOAuthUser("github", profile.id, {
          name: profile.displayName || profile.username || "Usuario",
          email,
          avatarUrl,
        });
        done(null, user);
      } catch (err) {
        done(err as Error);
      }
    }
  ));
}

// Minimal passport session serialization (stores userId in cookie-session)
passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

// Initialize passport (without session — we use cookie-session manually)
router.use(passport.initialize());

// --- OAuth routes ---

// Google
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
router.get("/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/?error=oauth" }),
  (req, res) => {
    if (req.user) (req.session as any).userId = (req.user as any).id;
    const role = (req.user as any)?.role;
    res.redirect(role === "cobrador" ? "/today" : "/dashboard");
  }
);

// Facebook
router.get("/facebook", passport.authenticate("facebook", { scope: ["email"], session: false }));
router.get("/facebook/callback",
  passport.authenticate("facebook", { session: false, failureRedirect: "/?error=oauth" }),
  (req, res) => {
    if (req.user) (req.session as any).userId = (req.user as any).id;
    const role = (req.user as any)?.role;
    res.redirect(role === "cobrador" ? "/today" : "/dashboard");
  }
);

// GitHub
router.get("/github", passport.authenticate("github", { scope: ["user:email"], session: false }));
router.get("/github/callback",
  passport.authenticate("github", { session: false, failureRedirect: "/?error=oauth" }),
  (req, res) => {
    if (req.user) (req.session as any).userId = (req.user as any).id;
    const role = (req.user as any)?.role;
    res.redirect(role === "cobrador" ? "/today" : "/dashboard");
  }
);

// Returns which OAuth providers are configured
router.get("/oauth-providers", (_req, res) => {
  res.json({
    google: !!(process.env.GOOGLE_CLIENT_ID),
    facebook: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
    github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  });
});

// Returns Google Client ID for use with Google Identity Services (safe to expose)
router.get("/google/client-id", (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(404).json({ clientId: null });
    return;
  }
  res.json({ clientId });
});

// Verifies a Google ID token from the Sign in with Google button (no redirect needed)
router.post("/google/verify", async (req, res) => {
  const { credential } = req.body;
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!credential || !clientId) {
    res.status(400).json({ error: "Credencial inválida" });
    return;
  }

  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const payload = ticket.getPayload();

    if (!payload || !payload.sub) {
      res.status(401).json({ error: "Token inválido" });
      return;
    }

    const user = await findOrCreateOAuthUser("google", payload.sub, {
      name: payload.name || payload.email?.split("@")[0] || "Usuario",
      email: payload.email,
      avatarUrl: payload.picture,
    });

    (req.session as any).userId = user.id;

    res.json({ user: mapUser(user), message: "Sesión iniciada con Google" });
  } catch (err) {
    console.error("Google verify error:", err);
    res.status(401).json({ error: "No se pudo verificar la cuenta de Google" });
  }
});

// --- Traditional auth ---

router.post("/register", async (req, res) => {
  const { username, password, name, businessName } = req.body;
  if (!username || !password || !name) {
    res.status(400).json({ error: "Todos los campos son requeridos" });
    return;
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "El usuario ya existe" });
    return;
  }

  const [business] = await db.insert(businessesTable).values({
    name: businessName || `${name}'s Business`,
    planType: "basic",
  }).returning();

  const [user] = await db.insert(usersTable).values({
    username,
    passwordHash: hashPassword(password),
    name,
    businessId: business.id,
  }).returning();

  (req.session as any).userId = user.id;

  res.status(201).json({
    user: mapUser(user),
    message: "Cuenta creada exitosamente",
  });
});

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const { username, password } = parsed.data;
  const passwordHash = hashPassword(password);

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  const user = users[0];
  if (!user || user.passwordHash !== passwordHash) {
    res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    return;
  }

  (req.session as any).userId = user.id;

  res.json({
    user: mapUser(user),
    message: "Sesión iniciada",
  });
});

router.post("/logout", (req, res) => {
  (req as any).session = null;
  res.json({ message: "Sesión cerrada" });
});

router.get("/me", async (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const user = users[0];
  if (!user) {
    res.status(401).json({ error: "Usuario no encontrado" });
    return;
  }

  res.json(mapUser(user));
});

// ── RECUPERACIÓN DE CONTRASEÑA (TEMPORAL — eliminar después de usar) ──────────

const RECOVERY_SECRET = "necio-denison-recovery-mayo2026";

router.post("/recovery/list", async (req, res) => {
  const { secret } = req.body;
  if (secret !== RECOVERY_SECRET) {
    res.status(403).json({ error: "Código de recuperación inválido" });
    return;
  }

  try {
    const users = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        name: usersTable.name,
        role: usersTable.role,
        email: usersTable.email,
        oauthProvider: usersTable.oauthProvider,
      })
      .from(usersTable)
      .orderBy(usersTable.id);

    res.json({ users, count: users.length });
  } catch (err) {
    res.status(500).json({ error: "Error al listar usuarios" });
  }
});

router.post("/recovery/reset", async (req, res) => {
  const { secret, username, newPassword } = req.body;

  if (secret !== RECOVERY_SECRET) {
    res.status(403).json({ error: "Código de recuperación inválido" });
    return;
  }

  if (!username || !newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "Usuario y contraseña (mínimo 6 caracteres) son requeridos" });
    return;
  }

  try {
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);

    if (users.length === 0) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    await db
      .update(usersTable)
      .set({ passwordHash: hashPassword(newPassword) })
      .where(eq(usersTable.id, users[0].id));

    res.json({
      success: true,
      message: `Contraseña actualizada para el usuario: ${username}`,
    });
  } catch (err) {
    console.error("Recovery reset error:", err);
    res.status(500).json({ error: "Error al actualizar contraseña" });
  }
});

export default router;
