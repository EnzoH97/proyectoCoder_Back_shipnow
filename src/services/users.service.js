import usersRepo from '../repositories/users.repo.js';
import AppError, { ErrorDictionary } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { storeUploadedFile, removeFile } from '../utils/fileStorage.js';
import { USER_ROLES, DOCUMENT_TYPES, USER_DOCUMENT_TYPES, UPLOAD_FIELDS  } from '../constants/constants.js';

class UsersService {
	
	async findAll() {
		return usersRepo.findAll();
	}
	
	async findById(id) {
		const user = await usersRepo.findById(id);
		
		if (!user) {
			throw new AppError(ErrorDictionary.USER_NOT_FOUND);
		}
		
		return user;
	}
	
	async create(requestData) {
		// los documentos solo se cargan por POST /api/users/:id/documents, no por el body
		const { documents, ...userData } = requestData;
		this.validateRole(userData.role);

		if (userData.role === USER_ROLES.ADMIN) {
			throw new AppError(ErrorDictionary.ADMIN_CREATION_FORBIDDEN);
		}

		const existingUser = await usersRepo.findByEmail(userData.email);

		if (existingUser) {
			throw new AppError(ErrorDictionary.EMAIL_ALREADY_EXISTS, [{ field: 'email', received: userData.email }]);
		}
		
		const newUser = await usersRepo.create(userData);
		logger.info(`Usuario creado: ${newUser._id} (rol ${newUser.role})`);
		return newUser;
	}

	async update(id, requestData) {
		// los documentos solo se cargan por POST /api/users/:id/documents, no por el body
		const { documents, ...userData } = requestData;
		this.validateRole(userData.role);

		const updatedUser = await usersRepo.update(id, userData);

		if (!updatedUser) {
			throw new AppError(ErrorDictionary.USER_NOT_FOUND);
		}
		return updatedUser;
	}


	async delete(id) {
		const deletedUser = await usersRepo.delete(id);
    
		if (!deletedUser) {
			throw new AppError(ErrorDictionary.USER_NOT_FOUND);
		}

		// los archivos del usuario no quedan huérfanos en el disco
		await Promise.all((deletedUser.documents ?? []).map((document) => removeFile(document.path)));

		logger.info(`Usuario eliminado: ${id}`);
		return deletedUser;
	}

	// Carga un documento del usuario: valida, guarda el archivo en la carpeta de su tipo y registra los metadatos.
	// file es el archivo que dejó Multer en uploads/tmp (req.file). Si algo falla, el archivo se borra del disco.
	async addDocument(id, file, type) {
		if (!file) {
			throw new AppError(ErrorDictionary.FILE_REQUIRED, [{ field: UPLOAD_FIELDS.USER_DOCUMENT }]);
		}

		let storedFile = null;

		try {
			// el tipo es opcional: si no se envía es un documento común del usuario
			const documentType = type ?? DOCUMENT_TYPES.USER_DOCUMENT;
			this.validateDocumentType(documentType);

			const user = await usersRepo.findById(id);
			if (!user) {
				throw new AppError(ErrorDictionary.USER_NOT_FOUND);
			}

			if (documentType === DOCUMENT_TYPES.DRIVER_LICENSE && user.role !== USER_ROLES.DRIVER) {
				throw new AppError(ErrorDictionary.USER_NOT_DRIVER);
			}

			storedFile = await storeUploadedFile(file, documentType);

			const updatedUser = await usersRepo.addDocument(id, storedFile);
			if (!updatedUser) {
				throw new AppError(ErrorDictionary.USER_NOT_FOUND);
			}

			logger.info(`Documento cargado para el usuario ${id}: ${documentType}`, {
				fileName: storedFile.fileName,
				size: storedFile.size,
				mimeType: storedFile.mimeType
			});
			return updatedUser;
		} catch (error) {
			// si el archivo ya se movió se borra de su carpeta; si no, del directorio temporal
			await removeFile(storedFile ? storedFile.path : file.path);
			logger.warning(`No se pudo cargar el documento del usuario ${id}`, { cause: error.message });
			throw error;
		}
	}

	validateDocumentType(type) {
		if (!USER_DOCUMENT_TYPES.includes(type)) {
			throw new AppError(ErrorDictionary.INVALID_DOCUMENT_TYPE, [
				{ field: 'type', received: type, allowed: USER_DOCUMENT_TYPES }
			]);
		}
	}

	validateRole(role) {
        if (role !== undefined && !Object.values(USER_ROLES).includes(role)) {
            throw new AppError(ErrorDictionary.INVALID_USER_ROLE, [
                { field: 'role', received: role, allowed: Object.values(USER_ROLES) }
            ]);
        }
    }
}

export default new UsersService();
