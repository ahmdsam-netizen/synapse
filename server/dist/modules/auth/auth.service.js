import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../config/database.js';
import { env } from '../../config/env.js';
import { UnauthorizedError, ValidationError, ConflictError } from '../../utils/errors.js';
function formatUser(row) {
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
async function generateTokens(userId, email, collegeId) {
    const accessToken = jwt.sign({ id: userId, email, collegeId }, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY });
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    // Convert env.JWT_REFRESH_EXPIRY (like "7d") to postgres interval format appropriately,
    // Assuming it's simple days. If it's complex, might need more parsing, but postgres understands "7 days"
    const intervalStr = env.JWT_REFRESH_EXPIRY.replace('d', ' days').replace('h', ' hours').replace('m', ' minutes');
    await query(`INSERT INTO refresh_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + $3::interval)`, [tokenHash, userId, intervalStr]);
    return { accessToken, refreshToken };
}
export async function signup(email, password, name) {
    const domain = email.split('@')[1]?.toLowerCase().trim();
    if (!domain) {
        throw new ValidationError('Invalid email format');
    }
    let collegeId = null;
    const collegeRes = await query(`SELECT id FROM colleges WHERE email_domain = $1`, [domain]);
    if (collegeRes.rows.length > 0) {
        collegeId = collegeRes.rows[0].id;
    }
    else {
        // Automatically register or link the domain so any email (e.g. gmail.com, outlook.com, custom) is supported
        const baseDomain = domain.split('.')[0] || 'Community';
        const friendlyName = baseDomain.charAt(0).toUpperCase() + baseDomain.slice(1) + ' Community';
        const fallbackCollege = await query(`INSERT INTO colleges (name, email_domain, city)
       VALUES ($1, $2, 'Global')
       ON CONFLICT (email_domain) DO UPDATE SET email_domain = EXCLUDED.email_domain
       RETURNING id`, [friendlyName, domain]);
        collegeId = fallbackCollege.rows[0]?.id || null;
    }
    const userRes = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (userRes.rows.length > 0) {
        throw new ConflictError('User already exists');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const insertUserRes = await query(`INSERT INTO users (email, password_hash, name, college_id, profile_completeness)
     VALUES ($1, $2, $3, $4, 0)
     RETURNING *`, [email, passwordHash, name, collegeId]);
    const userRow = insertUserRes.rows[0];
    const user = formatUser(userRow);
    const tokens = await generateTokens(user.id, user.email, user.collegeId);
    return { user, tokens };
}
export async function login(email, password) {
    const userRes = await query(`SELECT u.*, c.name as college_name 
     FROM users u 
     LEFT JOIN colleges c ON u.college_id = c.id 
     WHERE u.email = $1`, [email]);
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
export async function refreshToken(providedRefreshToken) {
    const tokenHash = crypto.createHash('sha256').update(providedRefreshToken).digest('hex');
    const res = await query(`SELECT user_id FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()`, [tokenHash]);
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
export async function logout(providedRefreshToken) {
    if (!providedRefreshToken)
        return;
    const tokenHash = crypto.createHash('sha256').update(providedRefreshToken).digest('hex');
    await query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
}
//# sourceMappingURL=auth.service.js.map