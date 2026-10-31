import usersRepo from '../repositories/users.repo.js';
import AppError, { ErrorDictionary } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { USER_ROLES } from '../constants/constants.js';

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
	
	async create(userData) {
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

	async update(id, userData) {
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

		logger.info(`Usuario eliminado: ${id}`);
		return deletedUser;
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
