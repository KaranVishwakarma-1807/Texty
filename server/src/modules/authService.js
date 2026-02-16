import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      username: user.username
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

export function verifyAuthToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (_err) {
    return null;
  }
}

export function parseBearerToken(authHeader) {
  if (!authHeader) return "";
  const [scheme, token] = String(authHeader).split(" ");
  if (scheme !== "Bearer" || !token) return "";
  return token;
}
