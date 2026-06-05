import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env['LOCAL_API_JWT_SECRET'] ?? 'pantryflow-local-dev-secret';
const TOKEN_EXPIRY = '7d';

export interface AuthTokenPayload {
  sub: string;
  email: string;
}

export function signToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}
