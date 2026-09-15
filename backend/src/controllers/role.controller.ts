import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as roleService from '../services/role.service';

export const listRoles = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await roleService.listRoles(), 'Roles fetched');
});

export const listPermissions = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await roleService.listPermissions(), 'Permissions fetched');
});
