import usersRepo from '../repositories/users.repo.js';
import AppError from '../utils/errors.js';
import { USER_ROLES } from '../constants/constants.js';

class UsersService {
	
	async findAll() {
		return usersRepo.findAll();
	}
	
	async findById(id) {
		const user = await usersRepo.findById(id);
		
		if (!user) {
			throw new AppError('Usuario no encontrado', 404);
		}
		
		return user;
	}
	
	async create(userData) {
		if (userData.role === USER_ROLES.ADMIN) {
			throw new AppError('No se puede crear un admin desde este endpoint', 403);
		}

		const existingUser = await usersRepo.findByEmail(userData.email);

		if (existingUser) {
			throw new AppError('Ya existe un usuario con ese email', 400);
		}

		const newUser = await usersRepo.create(userData);
		return newUser;
	}

	async update(id, userData) {
		const updatedUser = await usersRepo.update(id, userData);
		if (!updatedUser) {
			throw new AppError('Usuario no encontrado', 404);
		}
		return updatedUser;
	}


	async delete(id) {
		const deletedUser = await usersRepo.delete(id);
    
		if (!deletedUser) {
			throw new AppError('Usuario no encontrado', 404);
		}
		return deletedUser;
	}
}

export default new UsersService();
