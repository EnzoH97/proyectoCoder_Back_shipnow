import Delivery from '../models/delivery.model.js';

class DeliveriesRepository {

    async findAll(filter = {}) {

        return Delivery.find(filter)
        .populate('order')
        .populate('driver', 'firstName lastName email');
    }

    async findById(id) {
        return Delivery.findById(id)
        .populate('order')
        .populate('driver', 'firstName lastName email');
    }

    async insertMany(docs) {
        return Delivery.insertMany(docs);
    }

    async create(deliveryData) {
        return Delivery.create(deliveryData);
    }

    async update(id, deliveryData) {
        return Delivery.findByIdAndUpdate(id, deliveryData, { new: true });
    }

    async delete(id) {
        return Delivery.findByIdAndDelete(id);
    }
}

export default new DeliveriesRepository();
