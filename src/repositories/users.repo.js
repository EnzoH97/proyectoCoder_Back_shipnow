import User from '../models/user.model.js';

class UsersRepository {
    async findAll(filter = {}) {
        return User.find(filter);
    }

    async findById(id) {
        return User.findById(id);
    }

    async findByEmail(email) {
        return User.findOne({ email });
    }

    async insertMany(users) {
        return User.insertMany(users);
    }

    async create(userData) {
        return User.create(userData);
    }

    async update(id, userData) {
        return User.findByIdAndUpdate(id, userData, { new: true });
    }

    async delete(id) {
        return User.findByIdAndDelete(id);
    }
}

export default new UsersRepository();
