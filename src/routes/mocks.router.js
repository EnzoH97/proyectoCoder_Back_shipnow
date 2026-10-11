import { Router } from 'express';
import mocksController from '../controllers/mocks.controller.js';
const router = Router();

// devuelven datos simulados, no guardan nada
router.get('/users', mocksController.getUsers);
router.get('/drivers', mocksController.getDrivers);
router.get('/orders', mocksController.getOrders);
router.get('/deliveries', mocksController.getDeliveries);
router.get('/dataset', mocksController.getDataset);

// inserta datos de prueba en MongoDB
router.post('/seed', mocksController.seed);

export default router;
