import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as userService from '../services/user.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await userService.listUsers(req.query as unknown as Parameters<typeof userService.listUsers>[0]);
  sendSuccess(res, data, 'Users fetched', 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.id);
  sendSuccess(res, user, 'User fetched');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body, req.user!.sub);
  sendSuccess(res, user, 'User created successfully', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user!.sub);
  sendSuccess(res, user, 'User updated successfully');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await userService.deleteUser(req.params.id, req.user!.sub);
  sendSuccess(res, null, 'User deactivated successfully');
});
