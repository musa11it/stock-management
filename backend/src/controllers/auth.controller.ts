import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as authService from '../services/auth.service';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  sendSuccess(res, sanitize(result), 'Registration successful', 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body.email, req.body.password, {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, sanitize(result), 'Login successful');
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refreshAccessToken(req.body.refreshToken);
  sendSuccess(res, result, 'Token refreshed');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getCurrentUser(req.user!.sub);
  const { passwordHash, passwordResetToken, passwordResetExpires, ...safe } = user;
  sendSuccess(res, safe, 'Current user fetched');
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, null, 'Logged out successfully');
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword(req.user!.sub, req.body.currentPassword, req.body.newPassword);
  sendSuccess(res, null, 'Password changed successfully');
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const token = await authService.requestPasswordReset(req.body.email);
  sendSuccess(res, { resetToken: process.env.NODE_ENV === 'production' ? undefined : token }, 'If that account exists, a reset link has been generated');
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.newPassword);
  sendSuccess(res, null, 'Password reset successfully');
});

interface AuthResult {
  user: Record<string, unknown>;
  accessToken: string;
  refreshToken: string;
  permissions: string[];
}

function sanitize(result: AuthResult) {
  const { passwordHash, passwordResetToken, passwordResetExpires, ...safeUser } = result.user;
  return { ...result, user: safeUser };
}
