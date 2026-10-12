import usersRepo from '../repositories/users.repo.js';
import ordersRepo from '../repositories/orders.repo.js';
import deliveriesRepo from '../repositories/deliveries.repo.js';
import AppError from '../utils/errors.js';
import config from '../config/config.js';
import { calculateShippingCost } from './orders.service.js';
import {
    NODE_ENVS,
    USER_ROLES,
    ORDER_STATUS,
    DELIVERY_STATUS,
    DELIVERY_PRIORITY,
    DELIVERY_STATUS_BY_ORDER_STATUS,
    ORDER_STATUS_BY_DELIVERY_STATUS,
    MOCK_LIMITS,
    MOCK_COLLECTIONS,
    MOCK_COLLECTION_LABELS
} from '../constants/constants.js';
import {
    MOCK_PASSWORD,
    pick,
    chance,
    int,
    newId,
    randomPerson,
    randomAddress,
    randomItems,
    hoursAgo
} from '../utils/mockData.js';

// Roles que se pueden simular. El admin queda afuera: users.service tampoco permite crearlo.
const MOCK_ROLES = [USER_ROLES.CUSTOMER, USER_ROLES.DRIVER, USER_ROLES.STORE];

class MocksService {

    // ---------- validación ----------

    normalizeQty(rawQty) {
        if (rawQty === undefined || rawQty === '') {
            return MOCK_LIMITS.DEFAULT_QTY;
        }
        const qty = Number(rawQty);
        if (!Number.isInteger(qty) || qty < 1 || qty > MOCK_LIMITS.MAX_QTY) {
            throw new AppError(`qty debe ser un entero entre 1 y ${MOCK_LIMITS.MAX_QTY}`, 400);
        }
        return qty;
    }

    // ---------- generadores (no tocan la base) ----------

    buildUser(role) {
        return {
            _id: newId(),
            ...randomPerson(),
            password: MOCK_PASSWORD,
            role,
            documents: []
        };
    }

    // Reparte los roles en orden (customer, driver, store, customer...)
    // así con qty chico igual aparecen roles distintos.
    generateUsers(qty) {
        return Array.from({ length: qty }, (_, i) => this.buildUser(MOCK_ROLES[i % MOCK_ROLES.length]));
    }

    generateDrivers(qty) {
        return Array.from({ length: qty }, () => this.buildUser(USER_ROLES.DRIVER));
    }

    buildOrder(customerId, status = pick(Object.values(ORDER_STATUS))) {
        const items = randomItems();
        const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        // misma regla de costo de envío que usa el alta real de pedidos
        const shippingCost = calculateShippingCost({
            isProduction: config.nodeEnv === NODE_ENVS.PRODUCTION,
            shipmentValue: itemsTotal,
            apiKey: config.jwtSecret
        });

        return {
            _id: newId(),
            customer: customerId,
            items,
            deliveryAddress: randomAddress(),
            declaredValue: itemsTotal,
            shippingCost,
            total: itemsTotal + shippingCost,
            status,
            priority: pick(Object.values(DELIVERY_PRIORITY)),
            delivery: null
        };
    }

    // Devuelve la entrega que le corresponde al pedido según su estado (o null).
    // Deja el pedido apuntando a la entrega (order.delivery).
    // - cancelado: nunca tiene entrega
    // - creado: a veces todavía no tiene entrega (forceDelivery la obliga)
    buildDeliveryForOrder(order, driverIds, { forceDelivery = false } = {}) {
        const status = DELIVERY_STATUS_BY_ORDER_STATUS[order.status];
        if (!status) return null;
        if (order.status === ORDER_STATUS.CREATED && !forceDelivery && chance(0.5)) return null;

        const hasDriver = status !== DELIVERY_STATUS.PENDING;
        const assigned = hasDriver ? hoursAgo(int(24, 72)) : null;
        const delivery = {
            _id: newId(),
            order: order._id,
            driver: hasDriver ? pick(driverIds) : null,
            status,
            priority: order.priority,
            assignedAt: assigned,
            deliveredAt: status === DELIVERY_STATUS.DELIVERED ? hoursAgo(int(1, 23)) : null
        };
        order.delivery = delivery._id;
        return delivery;
    }

    // Dataset completo y relacionado: pedidos -> clientes, entregas -> pedidos y repartidores.
    buildDataset({ users, drivers, orders }) {
        const generatedUsers = this.generateUsers(users);
        const generatedDrivers = this.generateDrivers(drivers);

        // siempre hace falta al menos un cliente para colgarle pedidos
        const customers = generatedUsers.filter((u) => u.role === USER_ROLES.CUSTOMER);
        if (customers.length === 0) {
            customers.push(this.buildUser(USER_ROLES.CUSTOMER));
            generatedUsers.push(customers[0]);
        }
        const driverIds = generatedDrivers.map((d) => d._id);

        const generatedOrders = [];
        const generatedDeliveries = [];
        for (let i = 0; i < orders; i++) {
            const order = this.buildOrder(pick(customers)._id);
            const delivery = this.buildDeliveryForOrder(order, driverIds);
            generatedOrders.push(order);
            if (delivery) generatedDeliveries.push(delivery);
        }

        return {
            users: generatedUsers,
            drivers: generatedDrivers,
            orders: generatedOrders,
            deliveries: generatedDeliveries
        };
    }

    // ---------- endpoints GET (no guardan) ----------

    getUsers(rawQty) {
        return this.generateUsers(this.normalizeQty(rawQty));
    }

    getDrivers(rawQty) {
        return this.generateDrivers(this.normalizeQty(rawQty));
    }

    getOrders(rawQty) {
        const qty = this.normalizeQty(rawQty);
        return this.buildDataset({ users: 3, drivers: 2, orders: qty }).orders;
    }

    getDeliveries(rawQty) {
        const qty = this.normalizeQty(rawQty);
        const customerId = newId();
        const driverIds = [newId(), newId()];
        const deliveries = [];
        while (deliveries.length < qty) {
            const order = this.buildOrder(customerId);
            const delivery = this.buildDeliveryForOrder(order, driverIds, { forceDelivery: true });
            if (delivery) deliveries.push(delivery);
        }
        return deliveries;
    }

    getDataset(query = {}) {
        return this.buildDataset({
            users: this.normalizeQty(query.users),
            drivers: this.normalizeQty(query.drivers),
            orders: this.normalizeQty(query.orders)
        });
    }

    // ---------- seed (guarda en MongoDB) ----------

    async seed(collection = MOCK_COLLECTIONS.USERS, rawQty) {
        const qty = this.normalizeQty(rawQty);

        switch (collection) {
            case MOCK_COLLECTIONS.USERS:
                return this.seedUsers(qty);
            case MOCK_COLLECTIONS.DRIVERS:
                return this.seedDrivers(qty);
            case MOCK_COLLECTIONS.ORDERS:
                return this.seedOrders(qty);
            case MOCK_COLLECTIONS.DELIVERIES:
                return this.seedDeliveries(qty);
            case MOCK_COLLECTIONS.ALL:
                return this.seedAll(qty);
            default:
                throw new AppError(`collection inválida. Opciones: ${Object.values(MOCK_COLLECTIONS).join(', ')}`, 400);
        }
    }

    async seedUsers(qty) {
        const inserted = await usersRepo.insertMany(this.generateUsers(qty));
        return { insertados: inserted.length, coleccion: MOCK_COLLECTION_LABELS[MOCK_COLLECTIONS.USERS] };
    }

    async seedDrivers(qty) {
        const inserted = await usersRepo.insertMany(this.generateDrivers(qty));
        return { insertados: inserted.length, coleccion: MOCK_COLLECTION_LABELS[MOCK_COLLECTIONS.DRIVERS] };
    }

    // Pedidos nuevos para clientes que ya existen en la base. Entran como CREATED, igual que el alta real.
    async seedOrders(qty) {
        const customers = await usersRepo.findAll({ role: USER_ROLES.CUSTOMER });
        if (customers.length === 0) {
            throw new AppError('No hay clientes en la base. Primero ejecutá el seed de usuarios', 400);
        }

        const orders = Array.from({ length: qty }, () => {
            const order = this.buildOrder(pick(customers)._id, ORDER_STATUS.CREATED);
            delete order._id; // lo asigna MongoDB
            return order;
        });
        const inserted = await ordersRepo.insertMany(orders);
        return { insertados: inserted.length, coleccion: MOCK_COLLECTION_LABELS[MOCK_COLLECTIONS.ORDERS] };
    }

    // Entregas para pedidos existentes que todavía no tienen una.
    // Actualiza el pedido (delivery + estado) para que ambos lados queden coherentes.
    async seedDeliveries(qty) {
        const pendingOrders = await ordersRepo.findAll({ status: ORDER_STATUS.CREATED, delivery: null });
        if (pendingOrders.length === 0) {
            throw new AppError('No hay pedidos sin entrega. Primero ejecutá el seed de pedidos', 400);
        }
        const drivers = await usersRepo.findAll({ role: USER_ROLES.DRIVER });
        if (drivers.length === 0) {
            throw new AppError('No hay repartidores en la base. Primero ejecutá el seed de repartidores', 400);
        }

        const driverIds = drivers.map((d) => d._id);
        const targets = pendingOrders.slice(0, qty);

        const deliveries = targets.map((order) => {
            const status = pick(Object.values(DELIVERY_STATUS));
            // se reutiliza el armado de entregas: se simula un pedido con el estado equivalente
            const fake = { _id: order._id, priority: order.priority, status: ORDER_STATUS_BY_DELIVERY_STATUS[status] };
            const delivery = this.buildDeliveryForOrder(fake, driverIds, { forceDelivery: true });
            delete delivery._id;
            return delivery;
        });

        const inserted = await deliveriesRepo.insertMany(deliveries);

        for (const delivery of inserted) {
            await ordersRepo.update(delivery.order, {
                delivery: delivery._id,
                status: ORDER_STATUS_BY_DELIVERY_STATUS[delivery.status]
            });
        }

        return { insertados: inserted.length, coleccion: MOCK_COLLECTION_LABELS[MOCK_COLLECTIONS.DELIVERIES] };
    }

    // Todo en orden: usuarios -> repartidores -> pedidos -> entregas
    async seedAll(qty) {
        const resultados = [];
        resultados.push(await this.seedUsers(qty));
        resultados.push(await this.seedDrivers(Math.max(1, Math.ceil(qty / 2))));
        resultados.push(await this.seedOrders(qty));
        resultados.push(await this.seedDeliveries(qty));
        return { coleccion: MOCK_COLLECTION_LABELS[MOCK_COLLECTIONS.ALL], resultados };
    }
}

export default new MocksService();
