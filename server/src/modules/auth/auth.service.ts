import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../config/database';
import { env } from '../../config/env';
import { UnauthorizedError, ValidationError, ConflictError } from '../../utils/errors';

function formatUser(row: any) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    collegeId: row.college_id,
    profileCompleteness: row.profile_completeness,
    lastActive: row.last_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.college_name && { collegeName: row.college_name }),
  };
}

async function generateTokens(userId: string, email: string, collegeId: string) {
  const accessToken = jwt.sign(
    { id: userId, email, collegeId },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY }
  );

  const refreshToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  // Convert env.JWT_REFRESH_EXPIRY (like "7d") to postgres interval format appropriately,
  // Assuming it's simple days. If it's complex, might need more parsing, but postgres understands "7 days"
  const intervalStr = env.JWT_REFRESH_EXPIRY.replace('d', ' days').replace('h', ' hours').replace('m', ' minutes');

  await query(
    `INSERT INTO refresh_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + $3::interval)`,
    [tokenHash, userId, intervalStr]
  );

  return { accessToken, refreshToken };
}

export async function signup(email: string, password: string, name: string) {
  const domain = email.split('@')[1];
  if (!domain) {
    throw new ValidationError('Invalid email format');
  }

  const collegeRes = await query(`SELECT id FROM colleges WHERE email_domain = $1`, [domain]);
  if (collegeRes.rows.length === 0) {
    const allCollegesRes = await query(`SELECT name, email_domain FROM colleges ORDER BY name`);
    throw new ValidationError('Email domain not supported', { supportedColleges: allCollegesRes.rows });
  }
  const collegeId = collegeRes.rows[0].id;

  const userRes = await query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (userRes.rows.length > 0) {
    throw new ConflictError('User already exists');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const insertUserRes = await query(
    `INSERT INTO users (email, password_hash, name, college_id, profile_completeness)
     VALUES ($1, $2, $3, $4, 0)
     RETURNING *`,
    [email, passwordHash, name, collegeId]
  );
  
  const userRow = insertUserRes.rows[0];
  const user = formatUser(userRow);
  const tokens = await generateTokens(user.id, user.email, user.collegeId);

  return { user, tokens };
}

export async function login(email: string, password: string) {
  const userRes = await query(
    `SELECT u.*, c.name as college_name 
     FROM users u 
     JOIN colleges c ON u.college_id = c.id 
     WHERE u.email = $1`,
    [email]
  );
  
  if (userRes.rows.length === 0) {
    throw new UnauthorizedError('Invalid email or password');
  }
  
  const userRow = userRes.rows[0];
  const isValid = await bcrypt.compare(password, userRow.password_hash);
  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  await query(`UPDATE users SET last_active = NOW() WHERE id = $1`, [userRow.id]);

  const user = formatUser(userRow);
  const tokens = await generateTokens(user.id, user.email, user.collegeId);

  return { user, tokens };
}

export async function refreshToken(providedRefreshToken: string) {
  const tokenHash = crypto.createHash('sha256').update(providedRefreshToken).digest('hex');
  
  const res = await query(
    `SELECT user_id FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash]
  );
  
  if (res.rows.length === 0) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
  
  const userId = res.rows[0].user_id;
  
  await query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);

  const userRes = await query(`SELECT email, college_id FROM users WHERE id = $1`, [userId]);
  if (userRes.rows.length === 0) {
    throw new UnauthorizedError('User not found');
  }
  const user = userRes.rows[0];

  const tokens = await generateTokens(userId, user.email, user.college_id);

  return { tokens };
}

export async function logout(providedRefreshToken: string) {
  if (!providedRefreshToken) return;
  const tokenHash = crypto.createHash('sha256').update(providedRefreshToken).digest('hex');
  await query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
}
