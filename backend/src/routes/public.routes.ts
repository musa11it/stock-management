import { Router } from 'express';
import * as publicController from '../controllers/public.controller';

// Intentionally unauthenticated: this is the public-facing menu shown on the landing page.
const router = Router();

router.get('/menu', publicController.publicMenu);

export default router;
