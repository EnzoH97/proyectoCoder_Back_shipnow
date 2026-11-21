import { Router } from 'express';
import usersController from '../controllers/users.controller.js';
import { uploadUserDocument } from '../middlewares/upload.middleware.js';
const router = Router();

router.get('/', usersController.findAll);
router.get('/:id', usersController.findById);
router.post('/', usersController.create);
router.put('/:id', usersController.update);
router.delete('/:id', usersController.delete);
router.post('/:id/documents', uploadUserDocument, usersController.uploadDocument);

export default router;
