// backend/src/lib/jwt.ts
export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET не задан в переменных окружения');
  }
  return secret;
};
