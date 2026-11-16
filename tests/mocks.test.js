import { expect } from 'chai';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/user.model.js';
import Order from '../src/models/order.model.js';
import Delivery from '../src/models/delivery.model.js';
import { ErrorDictionary } from '../src/utils/errors.js';
import {
    USER_ROLES,
    ORDER_STATUS,
    DELIVERY_STATUS,
    DELIVERY_PRIORITY,
    MOCK_LIMITS,
    MOCK_COLLECTIONS
} from '../src/constants/constants.js';
import {
    clearDatabase,
    createUser,
    createDriver,
    createOrder,
    expectSuccess,
    expectApiError
} from './helpers/index.js';

const OBJECT_ID_FORMAT = /^[0-9a-f]{24}$/;

// Validaciones de forma que se repiten en varios tests
const expectMockUser = (user) => {
    expect(user).to.include.all.keys('_id', 'firstName', 'lastName', 'email', 'password', 'role', 'documents');
    expect(user._id).to.match(OBJECT_ID_FORMAT);
    expect(user.firstName).to.be.a('string').that.is.not.empty;
    expect(user.lastName).to.be.a('string').that.is.not.empty;
    expect(user.email).to.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    expect(user.role).to.be.oneOf(Object.values(USER_ROLES));
    expect(user.documents).to.be.an('array');
};

const expectMockOrder = (order) => {
    expect(order).to.include.all.keys(
        '_id', 'customer', 'items', 'deliveryAddress', 'declaredValue', 'shippingCost', 'total', 'status', 'priority', 'delivery'
    );
    expect(order._id).to.match(OBJECT_ID_FORMAT);
    expect(order.customer).to.match(OBJECT_ID_FORMAT);
    expect(order.items).to.be.an('array').that.is.not.empty;
    order.items.forEach((item) => {
        expect(item.name).to.be.a('string').that.is.not.empty;
        expect(item.quantity).to.be.a('number').that.satisfies(Number.isInteger).and.is.at.least(1);
        expect(item.price).to.be.a('number').and.is.at.least(0);
    });
    expect(order.deliveryAddress).to.be.a('string').that.is.not.empty;
    expect(order.status).to.be.oneOf(Object.values(ORDER_STATUS));
    expect(order.priority).to.be.oneOf(Object.values(DELIVERY_PRIORITY));
    const itemsTotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    expect(order.declaredValue).to.equal(itemsTotal);
    expect(order.total).to.equal(order.declaredValue + order.shippingCost);
    if (order.status === ORDER_STATUS.CANCELLED) {
        expect(order.delivery).to.be.null;
    }
};

const expectMockDelivery = (delivery) => {
    expect(delivery).to.include.all.keys('_id', 'order', 'driver', 'status', 'priority', 'assignedAt', 'deliveredAt');
    expect(delivery._id).to.match(OBJECT_ID_FORMAT);
    expect(delivery.order).to.match(OBJECT_ID_FORMAT);
    expect(delivery.status).to.be.oneOf(Object.values(DELIVERY_STATUS));
    expect(delivery.priority).to.be.oneOf(Object.values(DELIVERY_PRIORITY));
    if (delivery.status === DELIVERY_STATUS.PENDING) {
        expect(delivery.driver).to.be.null;
    } else {
        expect(delivery.driver).to.match(OBJECT_ID_FORMAT);
    }
    if (delivery.status === DELIVERY_STATUS.DELIVERED) {
        expect(delivery.deliveredAt).to.be.a('string');
    }
};

describe('Mocks API (/api/mocks)', () => {
    beforeEach(clearDatabase);

    // ---------- GET: datos simulados que NO se guardan ----------

    describe('GET /api/mocks/users', () => {
        it('responde 200 con la cantidad por defecto (5) si no se indica qty', async () => {
            const response = await request(app).get('/api/mocks/users');

            const body = expectSuccess(response, 200);
            expect(body.payload).to.be.an('array').with.lengthOf(MOCK_LIMITS.DEFAULT_QTY);
            body.payload.forEach(expectMockUser);
        });

        it('responde 200 con la cantidad pedida y reparte los roles sin generar admins', async () => {
            const response = await request(app).get('/api/mocks/users?qty=3');

            const body = expectSuccess(response, 200);
            expect(body.payload).to.have.lengthOf(3);
            body.payload.forEach(expectMockUser);
            expect(body.payload.map((user) => user.role)).to.deep.equal([
                USER_ROLES.CUSTOMER,
                USER_ROLES.DRIVER,
                USER_ROLES.STORE
            ]);
        });

        it('acepta los límites del rango (1 y 100)', async () => {
            const min = await request(app).get(`/api/mocks/users?qty=${MOCK_LIMITS.MIN_QTY}`);
            const max = await request(app).get(`/api/mocks/users?qty=${MOCK_LIMITS.MAX_QTY}`);

            expect(expectSuccess(min, 200).payload).to.have.lengthOf(MOCK_LIMITS.MIN_QTY);
            expect(expectSuccess(max, 200).payload).to.have.lengthOf(MOCK_LIMITS.MAX_QTY);
        });

        it('no guarda nada en la base de datos', async () => {
            await request(app).get('/api/mocks/users?qty=4');

            expect(await User.countDocuments()).to.equal(0);
        });

        it('genera emails distintos en cada usuario', async () => {
            const response = await request(app).get('/api/mocks/users?qty=20');

            const emails = response.body.payload.map((user) => user.email);
            expect(new Set(emails).size).to.equal(emails.length);
        });

        it('responde 400 QTY_NOT_INTEGER si qty no es numérico', async () => {
            const response = await request(app).get('/api/mocks/users?qty=abc');

            const body = expectApiError(response, 400, ErrorDictionary.QTY_NOT_INTEGER);
            expect(body.details).to.deep.equal([{ field: 'qty', received: 'abc' }]);
        });

        it('responde 400 QTY_NOT_INTEGER si qty es decimal', async () => {
            const response = await request(app).get('/api/mocks/users?qty=2.5');

            const body = expectApiError(response, 400, ErrorDictionary.QTY_NOT_INTEGER);
            expect(body.details).to.deep.equal([{ field: 'qty', received: '2.5' }]);
        });

        it('responde 400 QTY_NEGATIVE si qty es negativo', async () => {
            const response = await request(app).get('/api/mocks/users?qty=-5');

            const body = expectApiError(response, 400, ErrorDictionary.QTY_NEGATIVE);
            expect(body.details).to.deep.equal([{ field: 'qty', received: '-5', min: MOCK_LIMITS.MIN_QTY }]);
        });

        it('responde 400 QTY_OUT_OF_RANGE si qty es 0', async () => {
            const response = await request(app).get('/api/mocks/users?qty=0');

            const body = expectApiError(response, 400, ErrorDictionary.QTY_OUT_OF_RANGE);
            expect(body.details).to.deep.equal([
                { field: 'qty', received: '0', min: MOCK_LIMITS.MIN_QTY, max: MOCK_LIMITS.MAX_QTY }
            ]);
        });

        it('responde 400 QTY_OUT_OF_RANGE si qty supera el máximo', async () => {
            const response = await request(app).get('/api/mocks/users?qty=500');

            const body = expectApiError(response, 400, ErrorDictionary.QTY_OUT_OF_RANGE);
            expect(body.details).to.deep.equal([
                { field: 'qty', received: '500', min: MOCK_LIMITS.MIN_QTY, max: MOCK_LIMITS.MAX_QTY }
            ]);
        });
    });

    describe('GET /api/mocks/drivers', () => {
        it('responde 200 con repartidores (todos con rol driver)', async () => {
            const response = await request(app).get('/api/mocks/drivers?qty=4');

            const body = expectSuccess(response, 200);
            expect(body.payload).to.have.lengthOf(4);
            body.payload.forEach((driver) => {
                expectMockUser(driver);
                expect(driver.role).to.equal(USER_ROLES.DRIVER);
            });
        });

        it('responde 400 QTY_NEGATIVE si qty es negativo', async () => {
            const response = await request(app).get('/api/mocks/drivers?qty=-1');

            expectApiError(response, 400, ErrorDictionary.QTY_NEGATIVE);
        });
    });

    describe('GET /api/mocks/orders', () => {
        it('responde 200 con pedidos válidos y coherentes con los modelos y constantes', async () => {
            const response = await request(app).get('/api/mocks/orders?qty=6');

            const body = expectSuccess(response, 200);
            expect(body.payload).to.be.an('array').with.lengthOf(6);
            body.payload.forEach(expectMockOrder);
            expect(await Order.countDocuments()).to.equal(0); // no guarda nada
        });

        it('responde 400 QTY_OUT_OF_RANGE si qty supera el máximo', async () => {
            const response = await request(app).get('/api/mocks/orders?qty=101');

            expectApiError(response, 400, ErrorDictionary.QTY_OUT_OF_RANGE);
        });
    });

    describe('GET /api/mocks/deliveries', () => {
        it('responde 200 con entregas coherentes con su estado', async () => {
            const response = await request(app).get('/api/mocks/deliveries?qty=6');

            const body = expectSuccess(response, 200);
            expect(body.payload).to.be.an('array').with.lengthOf(6);
            body.payload.forEach(expectMockDelivery);
            expect(await Delivery.countDocuments()).to.equal(0); // no guarda nada
        });

        it('responde 400 QTY_NOT_INTEGER si qty no es numérico', async () => {
            const response = await request(app).get('/api/mocks/deliveries?qty=muchas');

            expectApiError(response, 400, ErrorDictionary.QTY_NOT_INTEGER);
        });
    });

    describe('GET /api/mocks/dataset', () => {
        it('responde 200 con usuarios, repartidores, pedidos y entregas relacionados entre sí', async () => {
            const response = await request(app).get('/api/mocks/dataset?users=3&drivers=2&orders=4');

            const body = expectSuccess(response, 200);
            const { users, drivers, orders, deliveries } = body.payload;
            expect(body.payload).to.have.all.keys('users', 'drivers', 'orders', 'deliveries');
            expect(users).to.have.lengthOf(3);
            expect(drivers).to.have.lengthOf(2);
            expect(orders).to.have.lengthOf(4);
            expect(deliveries).to.be.an('array');
            expect(deliveries.length).to.be.at.most(4); // cada pedido tiene a lo sumo una entrega

            users.forEach(expectMockUser);
            drivers.forEach(expectMockUser);
            orders.forEach(expectMockOrder);
            deliveries.forEach(expectMockDelivery);

            // las relaciones se corresponden: cada pedido apunta a un cliente, cada entrega a su pedido y a un repartidor
            const customerIds = users.filter((user) => user.role === USER_ROLES.CUSTOMER).map((user) => user._id);
            const driverIds = drivers.map((driver) => driver._id);
            const orderIds = orders.map((order) => order._id);
            orders.forEach((order) => expect(customerIds).to.include(order.customer));
            deliveries.forEach((delivery) => {
                expect(orderIds).to.include(delivery.order);
                if (delivery.driver !== null) {
                    expect(driverIds).to.include(delivery.driver);
                }
                const owner = orders.find((order) => order._id === delivery.order);
                expect(owner.delivery).to.equal(delivery._id);
            });
        });

        it('usa la cantidad por defecto en lo que no se indica', async () => {
            const response = await request(app).get('/api/mocks/dataset?orders=2');

            const { users, drivers, orders } = expectSuccess(response, 200).payload;
            expect(users).to.have.lengthOf(MOCK_LIMITS.DEFAULT_QTY);
            expect(drivers).to.have.lengthOf(MOCK_LIMITS.DEFAULT_QTY);
            expect(orders).to.have.lengthOf(2);
        });

        it('responde 400 QTY_NEGATIVE indicando qué parámetro es inválido', async () => {
            const response = await request(app).get('/api/mocks/dataset?orders=-1');

            const body = expectApiError(response, 400, ErrorDictionary.QTY_NEGATIVE);
            expect(body.details).to.deep.equal([{ field: 'orders', received: '-1', min: MOCK_LIMITS.MIN_QTY }]);
        });

        it('responde 400 QTY_NOT_INTEGER indicando qué parámetro es inválido', async () => {
            const response = await request(app).get('/api/mocks/dataset?users=abc');

            const body = expectApiError(response, 400, ErrorDictionary.QTY_NOT_INTEGER);
            expect(body.details).to.deep.equal([{ field: 'users', received: 'abc' }]);
        });
    });

    // ---------- POST: datos simulados que SÍ se guardan en la base de test ----------

    describe('POST /api/mocks/seed', () => {
        it('responde 201 e inserta usuarios por defecto (collection=users)', async () => {
            const response = await request(app).post('/api/mocks/seed?qty=3');

            const body = expectSuccess(response, 201);
            expect(body).to.include({ insertados: 3, coleccion: 'usuarios' });
            expect(await User.countDocuments()).to.equal(3);
        });

        it('responde 201 e inserta repartidores (todos con rol driver)', async () => {
            const response = await request(app).post('/api/mocks/seed?collection=drivers&qty=2');

            const body = expectSuccess(response, 201);
            expect(body).to.include({ insertados: 2, coleccion: 'repartidores' });
            expect(await User.countDocuments({ role: USER_ROLES.DRIVER })).to.equal(2);
            expect(await User.countDocuments()).to.equal(2);
        });

        it('responde 201 e inserta pedidos para los clientes existentes, en estado created', async () => {
            const customer = await createUser();

            const response = await request(app).post('/api/mocks/seed?collection=orders&qty=3');

            const body = expectSuccess(response, 201);
            expect(body).to.include({ insertados: 3, coleccion: 'pedidos' });
            const orders = await Order.find();
            expect(orders).to.have.lengthOf(3);
            orders.forEach((order) => {
                expect(order.customer.toString()).to.equal(customer._id.toString());
                expect(order.status).to.equal(ORDER_STATUS.CREATED);
                expect(order.delivery).to.be.null;
            });
        });

        it('responde 201 e inserta entregas para los pedidos sin entrega, dejando el pedido coherente', async () => {
            const customer = await createUser();
            await createDriver();
            await createOrder(customer._id);
            await createOrder(customer._id);

            const response = await request(app).post('/api/mocks/seed?collection=deliveries&qty=2');

            const body = expectSuccess(response, 201);
            expect(body).to.include({ insertados: 2, coleccion: 'entregas' });
            const deliveries = await Delivery.find();
            expect(deliveries).to.have.lengthOf(2);
            for (const delivery of deliveries) {
                const order = await Order.findById(delivery.order);
                expect(order.delivery.toString()).to.equal(delivery._id.toString());
            }
        });

        it('responde 201 con el detalle de cada colección y deja todo relacionado (collection=all)', async () => {
            const response = await request(app).post('/api/mocks/seed?collection=all&qty=3');

            const body = expectSuccess(response, 201);
            expect(body.coleccion).to.equal('todas');
            expect(body.resultados).to.be.an('array').with.lengthOf(4);
            expect(body.resultados.map((result) => result.coleccion)).to.deep.equal([
                'usuarios',
                'repartidores',
                'pedidos',
                'entregas'
            ]);
            body.resultados.forEach((result) => {
                expect(result.insertados).to.be.a('number').and.is.at.least(1);
            });

            expect(await Order.countDocuments()).to.equal(3);
            expect(await Delivery.countDocuments()).to.equal(3);
            const deliveries = await Delivery.find();
            for (const delivery of deliveries) {
                const order = await Order.findById(delivery.order);
                expect(order.delivery.toString()).to.equal(delivery._id.toString());
            }
        });

        it('responde 400 INVALID_MOCK_COLLECTION si la colección no existe', async () => {
            const response = await request(app).post('/api/mocks/seed?collection=foo');

            const body = expectApiError(response, 400, ErrorDictionary.INVALID_MOCK_COLLECTION);
            expect(body.details).to.deep.equal([
                { field: 'collection', received: 'foo', allowed: Object.values(MOCK_COLLECTIONS) }
            ]);
            expect(await User.countDocuments()).to.equal(0);
        });

        it('responde 400 QTY_NEGATIVE si qty es negativo y no inserta nada', async () => {
            const response = await request(app).post('/api/mocks/seed?qty=-3');

            expectApiError(response, 400, ErrorDictionary.QTY_NEGATIVE);
            expect(await User.countDocuments()).to.equal(0);
        });

        it('responde 400 QTY_OUT_OF_RANGE si qty supera el máximo y no inserta nada', async () => {
            const response = await request(app).post('/api/mocks/seed?qty=500');

            expectApiError(response, 400, ErrorDictionary.QTY_OUT_OF_RANGE);
            expect(await User.countDocuments()).to.equal(0);
        });

        it('responde 400 QTY_NOT_INTEGER si qty no es numérico', async () => {
            const response = await request(app).post('/api/mocks/seed?qty=abc');

            expectApiError(response, 400, ErrorDictionary.QTY_NOT_INTEGER);
        });

        it('responde 409 NO_CUSTOMERS_FOR_MOCK si se piden pedidos y no hay clientes', async () => {
            const response = await request(app).post('/api/mocks/seed?collection=orders');

            expectApiError(response, 409, ErrorDictionary.NO_CUSTOMERS_FOR_MOCK);
            expect(await Order.countDocuments()).to.equal(0);
        });

        it('responde 409 NO_PENDING_ORDERS_FOR_MOCK si se piden entregas y no hay pedidos sin entrega', async () => {
            const response = await request(app).post('/api/mocks/seed?collection=deliveries');

            expectApiError(response, 409, ErrorDictionary.NO_PENDING_ORDERS_FOR_MOCK);
            expect(await Delivery.countDocuments()).to.equal(0);
        });

        it('responde 409 NO_DRIVERS_FOR_MOCK si se piden entregas y no hay repartidores', async () => {
            const customer = await createUser();
            await createOrder(customer._id);

            const response = await request(app).post('/api/mocks/seed?collection=deliveries');

            expectApiError(response, 409, ErrorDictionary.NO_DRIVERS_FOR_MOCK);
            expect(await Delivery.countDocuments()).to.equal(0);
        });
    });
});
