import { Pool } from "pg";

const useSsl = process.env.PG_SSL === "true" || process.env.PG_SSL === "1";
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    const tableCheck = await client.query(
      "SELECT to_regclass('public.users') AS users_table, to_regclass('public.rooms') AS rooms_table"
    );
    const hasUsers = Boolean(tableCheck.rows[0]?.users_table);
    const hasRooms = Boolean(tableCheck.rows[0]?.rooms_table);
    if (!hasUsers || !hasRooms) {
      throw new Error("Database schema missing. Run: npm --prefix server run migrate");
    }
  } finally {
    client.release();
  }
}

export async function createUser(username, passwordHash) {
  const result = await pool.query(
    `
      INSERT INTO users (username, password_hash)
      VALUES ($1, $2)
      RETURNING id, username
    `,
    [username, passwordHash]
  );
  return result.rows[0];
}

export async function findUserByUsername(username) {
  const result = await pool.query(
    `
      SELECT id, username, password_hash AS "passwordHash", created_at AS "createdAt"
      FROM users
      WHERE username = $1
      LIMIT 1
    `,
    [username]
  );
  return result.rows[0] || null;
}

export async function findUserById(id) {
  const result = await pool.query(
    `
      SELECT id, username, created_at AS "createdAt"
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

export async function ensureRoom(roomName) {
  const result = await pool.query(
    `
      INSERT INTO rooms (name)
      VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `,
    [roomName]
  );
  return result.rows[0];
}

export async function ensureMembership(userId, roomId) {
  await pool.query(
    `
      INSERT INTO memberships (user_id, room_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, room_id) DO NOTHING
    `,
    [userId, roomId]
  );
}

export async function saveMessage(roomName, userId, text, sentAtIso) {
  const room = await ensureRoom(roomName);
  await pool.query(
    `
      INSERT INTO messages (room_id, user_id, body, sent_at)
      VALUES ($1, $2, $3, $4)
    `,
    [room.id, userId, text, sentAtIso]
  );
}

export async function getRoomMessages(roomName, limit = 100) {
  const normalizedLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 100;
  const result = await pool.query(
    `
      SELECT
        m.id,
        r.name AS "roomId",
        u.username AS "userName",
        m.body AS text,
        m.sent_at AS "sentAt"
      FROM messages m
      INNER JOIN users u ON u.id = m.user_id
      INNER JOIN rooms r ON r.id = m.room_id
      WHERE r.name = $1
      ORDER BY m.id DESC
      LIMIT $2
    `,
    [roomName, normalizedLimit]
  );
  return result.rows.reverse();
}

export async function closeDatabase() {
  await pool.end();
}
