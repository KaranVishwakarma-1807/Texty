import express from "express";
import bcrypt from "bcryptjs";
import { createUser, findUserById, findUserByUsername } from "../modules/db.js";
import { parseBearerToken, signAuthToken, verifyAuthToken } from "../modules/authService.js";

const router = express.Router();

function sanitizeUsername(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 30);
}

router.post("/register", async (req, res) => {
  try {
    const username = sanitizeUsername(req.body?.username);
    const password = String(req.body?.password || "");

    if (!username || password.length < 6) {
      res.status(400).json({ error: "Username is required and password must be at least 6 characters." });
      return;
    }

    const exists = await findUserByUsername(username);
    if (exists) {
      res.status(409).json({ error: "Username already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser(username, passwordHash);
    const token = signAuthToken(user);

    res.status(201).json({
      token,
      user: {
        id: Number(user.id),
        username: user.username
      }
    });
  } catch (_err) {
    res.status(500).json({ error: "Registration failed." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const username = sanitizeUsername(req.body?.username);
    const password = String(req.body?.password || "");

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required." });
      return;
    }

    const user = await findUserByUsername(username);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    const token = signAuthToken(user);
    res.json({
      token,
      user: {
        id: Number(user.id),
        username: user.username
      }
    });
  } catch (_err) {
    res.status(500).json({ error: "Login failed." });
  }
});

router.get("/me", async (req, res) => {
  try {
    const token = parseBearerToken(req.get("authorization"));
    const payload = verifyAuthToken(token);

    if (!payload?.sub) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }

    const user = await findUserById(Number(payload.sub));
    if (!user) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }

    res.json({ user });
  } catch (_err) {
    res.status(500).json({ error: "Failed to fetch user profile." });
  }
});

export default router;
