import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { UnauthorizedError, ValidationError, ConflictError } from '../../utils/errors.js';

function formatUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    collegeId: user.collegeId ?? user.college_id,
    profileCompleteness: user.profileCompleteness ?? user.profile_completeness ?? 0,
    lastActive: user.lastActive ?? user.last_active,
    createdAt: user.createdAt ?? user.created_at,
    updatedAt: user.updatedAt ?? user.updated_at,
    ...(user.college?.name && { collegeName: user.college.name }),
    ...(user.college_name && { collegeName: user.college_name }),
  };
}

function calculateRefreshExpiryDate(expiryStr: string): Date {
  const now = new Date();
  const daysMatch = expiryStr.match(/^(\d+)d$/);
  if (daysMatch) {
    now.setDate(now.getDate() + parseInt(daysMatch[1], 10));
    return now;
  }
  const hoursMatch = expiryStr.match(/^(\d+)h$/);
  if (hoursMatch) {
    now.setHours(now.getHours() + parseInt(hoursMatch[1], 10));
    return now;
  }
  // Default fallback: 7 days
  now.setDate(now.getDate() + 7);
  return now;
}

async function generateTokens(userId: string, email: string, collegeId: string | null) {
  const accessToken = jwt.sign(
    { id: userId, email, collegeId },
    env.JWT_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY as any }
  );

  const refreshToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = calculateRefreshExpiryDate(env.JWT_REFRESH_EXPIRY);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { accessToken, refreshToken };
}

export async function signup(email: string, password: string, name: string) {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) {
    throw new ValidationError('Invalid email format');
  }

  let collegeId: string | null = null;
  const existingCollege = await prisma.college.findUnique({
    where: { emailDomain: domain },
  });

  if (existingCollege) {
    collegeId = existingCollege.id;
  } else {
    // Automatically register or link the domain so any email is supported
    const baseDomain = domain.split('.')[0] || 'Community';
    const friendlyName = baseDomain.charAt(0).toUpperCase() + baseDomain.slice(1) + ' Community';
    const fallbackCollege = await prisma.college.upsert({
      where: { emailDomain: domain },
      update: {},
      create: {
        name: friendlyName,
        emailDomain: domain,
        city: 'Global',
      },
    });
    collegeId = fallbackCollege.id;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  if (existingUser) {
    throw new ConflictError('User already exists');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const createdUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      collegeId,
      profileCompleteness: 0,
    },
    include: {
      college: true,
    },
  });

  const user = formatUser(createdUser);
  const tokens = await generateTokens(user.id, user.email, user.collegeId);

  return { user, tokens };
}

export async function login(email: string, password: string) {
  const userRecord = await prisma.user.findUnique({
    where: { email },
    include: {
      college: true,
    },
  });

  if (!userRecord) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isValid = await bcrypt.compare(password, userRecord.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  await prisma.user.update({
    where: { id: userRecord.id },
    data: { lastActive: new Date() },
  });

  const user = formatUser(userRecord);
  const tokens = await generateTokens(user.id, user.email, user.collegeId);

  return { user, tokens };
}

export async function refreshToken(providedRefreshToken: string) {
  const tokenHash = crypto.createHash('sha256').update(providedRefreshToken).digest('hex');

  const tokenRecord = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: new Date() },
    },
  });

  if (!tokenRecord) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const userId = tokenRecord.userId;

  // Single-use refresh token: revoke upon consumption
  await prisma.refreshToken.deleteMany({
    where: { tokenHash },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, collegeId: true },
  });

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  const tokens = await generateTokens(userId, user.email, user.collegeId);

  return { tokens };
}

export async function logout(providedRefreshToken: string) {
  if (!providedRefreshToken) return;
  const tokenHash = crypto.createHash('sha256').update(providedRefreshToken).digest('hex');
  await prisma.refreshToken.deleteMany({
    where: { tokenHash },
  });
}
