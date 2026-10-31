import deliveriesRepo from '../repositories/deliveries.repo.js';
import ordersRepo from '../repositories/orders.repo.js';
import usersRepo from '../repositories/users.repo.js';
import AppError, { ErrorDictionary } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { USER_ROLES, DELIVERY_STATUS, DELIVERY_PRIORITY } from '../constants/constants.js';

class DeliveriesService {
    async findAll(filter = {}) {
        return deliveriesRepo.findAll(filter);
    }
    
    async findById(id) {
        const delivery = await deliveriesRepo.findById(id);
        if (!delivery) {
            throw new AppError(ErrorDictionary.DELIVERY_NOT_FOUND);
        }
        return delivery;
    }
    
    async create(deliveryData) {
        this.validateStatus(deliveryData.status);
        this.validatePriority(deliveryData.priority);

        const order = await ordersRepo.findById(deliveryData.order);
        if (!order) {
            throw new AppError(ErrorDictionary.ORDER_NOT_FOUND);
        }
        if (deliveryData.driver) {
            const driver = await usersRepo.findById(deliveryData.driver);
            
            if (!driver) {
                throw new AppError(ErrorDictionary.DRIVER_NOT_FOUND);
            }
            
            if (driver.role !== USER_ROLES.DRIVER) {
                throw new AppError(ErrorDictionary.USER_NOT_DRIVER);
            }
        }
        
        const newDelivery = await deliveriesRepo.create(deliveryData);

        if (!newDelivery.driver) {
            logger.warning(`Entrega ${newDelivery._id} creada sin repartidor asignado (pedido ${deliveryData.order})`);
        } else {
            logger.info(`Entrega creada: ${newDelivery._id} (pedido ${deliveryData.order})`);
        }
        return newDelivery;
    }

    async update(id, deliveryData) {
        this.validateStatus(deliveryData.status);
        this.validatePriority(deliveryData.priority);

        const updatedDelivery = await deliveriesRepo.update(id, deliveryData);
        
        if (!updatedDelivery) {
            throw new AppError(ErrorDictionary.DELIVERY_NOT_FOUND);
        }
        
        logger.info(`Entrega actualizada: ${id}`, deliveryData.status ? { status: deliveryData.status } : {});
        return updatedDelivery;
    }
    
    async delete(id) {
        const deletedDelivery = await deliveriesRepo.delete(id);
        
        if (!deletedDelivery) {
            throw new AppError(ErrorDictionary.DELIVERY_NOT_FOUND);
        }
        return deletedDelivery;
    }

     // ---------- validaciones del dominio ----------

    validateStatus(status) {
        if (status !== undefined && !Object.values(DELIVERY_STATUS).includes(status)) {
            throw new AppError(ErrorDictionary.INVALID_DELIVERY_STATUS, [
                { field: 'status', received: status, allowed: Object.values(DELIVERY_STATUS) }
            ]);
        }
    }

    validatePriority(priority) {
        if (priority !== undefined && !Object.values(DELIVERY_PRIORITY).includes(priority)) {
            throw new AppError(ErrorDictionary.INVALID_PRIORITY, [
                { field: 'priority', received: priority, allowed: Object.values(DELIVERY_PRIORITY) }
            ]);
        }
    }
}

export default new DeliveriesService();
