import { expect } from 'chai';
import User from '../../src/models/user.model.js';
import Order from '../../src/models/order.model.js';
import Delivery from '../../src/models/delivery.model.js';
import {
    USER_ROLES,
    ORDER_STATUS,
    DELIVERY_STATUS,
    DELIVERY_PRIORITY
} from '../../src/constants/constants.js';

// ---------- ids para los casos de error ----------

// ObjectId con formato válido pero que no existe en la base (siempre da 404)
export const NON_EXISTENT_ID = '665f4d0a8f9a1b001234abcd';

// no es un ObjectId (siempre da 400 INVALID_ID)
export const MALFORMED_ID = 'no-soy-un-id';

// ---------- limpieza ----------

// Se usa en el beforeEach de cada archivo de tests: cada test arranca con las colecciones vacías,
// así no depende de lo que dejó otro test ni del orden de ejecución.
export async function clearDatabase() {
    await Promise.all([
        User.deleteMany({}),
        Order.deleteMany({}),
        Delivery.deleteMany({})
    ]);
}

// ---------- datos de prueba controlados ----------
// Todo se crea dentro del entorno de testing: nada depende de datos cargados a mano.

let sequence = 0;

// Usuario válido. El email es único y siempre del dominio de prueba.
export function buildUserData(overrides = {}) {
    sequence += 1;
    return {
        firstName: 'Usuario',
        lastName: `Prueba${sequence}`,
        email: `usuario${sequence}@shipnow-test.com`,
        password: 'Test1234',
        role: USER_ROLES.CUSTOMER,
        ...overrides
    };
}

export async function createUser(overrides = {}) {
    return User.create(buildUserData(overrides));
}

export async function createDriver(overrides = {}) {
    return createUser({ role: USER_ROLES.DRIVER, ...overrides });
}

// Items fijos para que el total sea siempre el mismo: 2 x 9000 + 1 x 4000 = 22000
export const ORDER_ITEMS = Object.freeze([
    Object.freeze({ name: 'Termo acero 1L', quantity: 2, price: 9000 }),
    Object.freeze({ name: 'Cargador USB-C', quantity: 1, price: 4000 })
]);
export const ORDER_ITEMS_TOTAL = 22000;

// Fuera de producción el costo de envío es fijo (ver calculateShippingCost en orders.service.js)
export const SHIPPING_COST_OUTSIDE_PRODUCTION = 10;

// Body válido para POST /api/orders
export function buildOrderData(customerId, overrides = {}) {
    return {
        customer: String(customerId),
        items: ORDER_ITEMS.map((item) => ({ ...item })),
        deliveryAddress: 'San Martín 1234, Mendoza',
        priority: DELIVERY_PRIORITY.NORMAL,
        ...overrides
    };
}

// Pedido ya guardado en la base (con los campos calculados que completa el servicio al crearlo)
export async function createOrder(customerId, overrides = {}) {
    return Order.create({
        ...buildOrderData(customerId),
        declaredValue: ORDER_ITEMS_TOTAL,
        shippingCost: SHIPPING_COST_OUTSIDE_PRODUCTION,
        total: ORDER_ITEMS_TOTAL + SHIPPING_COST_OUTSIDE_PRODUCTION,
        status: ORDER_STATUS.CREATED,
        ...overrides
    });
}

// Entrega ya guardada en la base
export async function createDelivery(orderId, overrides = {}) {
    return Delivery.create({
        order: orderId,
        status: DELIVERY_STATUS.PENDING,
        priority: DELIVERY_PRIORITY.NORMAL,
        ...overrides
    });
}

// ---------- validaciones comunes de respuestas ----------

// Respuesta exitosa: status HTTP esperado, JSON y { status: 'success', ... }
export function expectSuccess(response, expectedStatus = 200) {
    expect(response.status, 'status HTTP').to.equal(expectedStatus);
    expect(response.headers['content-type']).to.match(/application\/json/);
    expect(response.body).to.have.property('status', 'success');
    return response.body;
}

// Respuesta de error: status HTTP esperado y el formato uniforme definido en el módulo de errores
// (src/utils/errors.js): { status: 'error', code, message, details: [] }
export function expectApiError(response, expectedStatus, errorDefinition) {
    expect(response.status, 'status HTTP').to.equal(expectedStatus);
    expect(response.headers['content-type']).to.match(/application\/json/);
    expect(response.body).to.have.all.keys('status', 'code', 'message', 'details');
    expect(response.body.status).to.equal('error');
    expect(response.body.code).to.equal(errorDefinition.code);
    expect(response.body.message).to.equal(errorDefinition.message);
    expect(response.body.details).to.be.an('array');
    return response.body;
}

// Busca dentro de body.details el detalle de un campo (por ejemplo 'deliveryAddress')
export function findDetail(body, field) {
    return body.details.find((detail) => detail.field === field);
}
