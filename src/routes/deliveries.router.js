import { Router } from 'express';
import deliveriesController from '../controllers/deliveries.controller.js';
import { uploadDeliveryProof } from '../middlewares/upload.middleware.js';
const router = Router();

router.get('/', deliveriesController.findAll);
router.get('/:id', deliveriesController.findById);
router.post('/', deliveriesController.create);
router.put('/:id', deliveriesController.update);
router.delete('/:id', deliveriesController.delete);
router.post('/:id/proofs', uploadDeliveryProof, deliveriesController.uploadProof);


export default router;
