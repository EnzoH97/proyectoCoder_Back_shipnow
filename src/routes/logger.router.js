import { Router } from 'express';
import loggerController from '../controllers/logger.controller.js';
const router = Router();

// herramienta interna para verificar la configuración del logger (no es parte del negocio)
router.get('/test', loggerController.test);

export default router;
