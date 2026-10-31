import ordersRepo from '../repositories/orders.repo.js';
import usersRepo from '../repositories/users.repo.js';
import AppError, { ErrorDictionary } from '../utils/errors.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import { NODE_ENVS, ORDER_STATUS, DELIVERY_PRIORITY } from '../constants/constants.js';

export function calculateShippingCost({ isProduction, shipmentValue, apiKey }) {
    
    if (!apiKey) {
        throw new AppError(ErrorDictionary.CONFIG_ERROR);
    }

    if (isProduction) {
        return 50 + shipmentValue * 0.01;
    }
    
    return 10;
}

class OrdersService {
    async findAll(filter = {}) {
        return ordersRepo.findAll(filter);
    }
    
    async findById(id) {
        const order = await ordersRepo.findById(id);
        
        if (!order) {
            throw new AppError(ErrorDictionary.ORDER_NOT_FOUND);
        }
        return order;
    }
    
    async create(orderData) {
        const customer = await usersRepo.findById(orderData.customer);
        if (!customer) {
            throw new AppError(ErrorDictionary.CUSTOMER_NOT_FOUND);
        }

        this.validateItems(orderData.items);
        this.validatePriority(orderData.priority);

        const itemsTotal = orderData.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        const declaredValue = orderData.declaredValue || itemsTotal;
        const shippingCost = calculateShippingCost({
            isProduction: config.nodeEnv === NODE_ENVS.PRODUCTION,
            shipmentValue: declaredValue,
            apiKey: config.jwtSecret
        });

        const newOrder = await ordersRepo.create({
            ...orderData,
            declaredValue,
            shippingCost,
            total: itemsTotal + shippingCost,
            status: ORDER_STATUS.CREATED,
            priority: orderData.priority || DELIVERY_PRIORITY.NORMAL
        });
        
        logger.info(`Pedido creado: ${newOrder._id} (cliente ${orderData.customer}, total ${newOrder.total})`);
        return newOrder;
    }
    
    async update(id, orderData) {
        this.validateStatus(orderData.status);
        this.validatePriority(orderData.priority);
        if (orderData.items !== undefined) {
            this.validateItems(orderData.items);
        }

        const updatedOrder = await ordersRepo.update(id, orderData);
    
        if (!updatedOrder) {
            throw new AppError(ErrorDictionary.ORDER_NOT_FOUND);
        }
    
        logger.info(`Pedido actualizado: ${id}`, orderData.status ? { status: orderData.status } : {});
        return updatedOrder;
    }


    async delete(id) {
        const deletedOrder = await ordersRepo.delete(id);
        
        if (!deletedOrder) {
            throw new AppError(ErrorDictionary.ORDER_NOT_FOUND);
        }
        
        logger.info(`Pedido eliminado: ${id}`);
        return deletedOrder;
    }

    // ---------- validaciones del dominio ----------

    validateItems(items) {
        if (!Array.isArray(items) || items.length === 0) {
            throw new AppError(ErrorDictionary.ORDER_WITHOUT_ITEMS);
        }

        const details = [];
        items.forEach((item, index) => {
            if (!item || typeof item.name !== 'string' || item.name.trim() === '') {
                details.push({ field: `items[${index}].name`, message: 'El nombre del item es obligatorio' });
            }
            if (!Number.isInteger(item?.quantity) || item.quantity < 1) {
                details.push({ field: `items[${index}].quantity`, message: 'La cantidad debe ser un entero mayor o igual a 1' });
            }
            if (typeof item?.price !== 'number' || Number.isNaN(item.price) || item.price < 0) {
                details.push({ field: `items[${index}].price`, message: 'El precio debe ser un número mayor o igual a 0' });
            }
        });

        if (details.length > 0) {
            throw new AppError(ErrorDictionary.INVALID_ORDER_ITEMS, details);
        }
    }

    validateStatus(status) {
        if (status !== undefined && !Object.values(ORDER_STATUS).includes(status)) {
            throw new AppError(ErrorDictionary.INVALID_ORDER_STATUS, [
                { field: 'status', received: status, allowed: Object.values(ORDER_STATUS) }
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

export default new OrdersService();
