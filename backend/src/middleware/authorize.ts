import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { PermissionKey } from '../constants/permissions';

/**
 * Requires the authenticated user to hold ALL of the given permissions.
 * SUPER_ADMIN always passes (permissions array contains '*').
 */
export function requirePermission(...permissions: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }

    if (req.user.permissions.includes('*')) {
      next();
      return;
    }

    const hasAll = permissions.every((p) => req.user!.permissions.includes(p));
    if (!hasAll) {
      next(AppError.forbidden('You do not have permission to perform this action'));
      return;
    }

    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (req.user.role === 'SUPER_ADMIN' || roles.includes(req.user.role)) {
      next();
      return;
    }
    next(AppError.forbidden('You do not have permission to perform this action'));
  };
}
