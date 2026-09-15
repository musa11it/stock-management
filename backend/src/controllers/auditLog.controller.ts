import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { listAuditLogs } from '../services/auditLog.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await listAuditLogs(req.query as unknown as Parameters<typeof listAuditLogs>[0]);
  sendSuccess(res, data, 'Audit logs fetched', 200, meta);
});
