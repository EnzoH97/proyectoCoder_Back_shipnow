import { expect } from 'chai';
import request from 'supertest';
import app from '../src/app.js';
import Order from '../src/models/order.model.js';
import { ErrorDictionary } from '../src/utils/errors.js';
import { ORDER_STATUS, DELIVERY_PRIORITY } from '../src/constants/constants.js';
import {
    clearDatabase,
    createUser,
    createOrder,
    buildOrderData,
    expectSuccess,
    expectApiError,
    findDetail,
    ORDER_ITEMS,
    ORDER_ITEMS_TOTAL,
    SHIPPING_COST_OUTSIDE_PRODUCTION,
    NON_EXISTENT_ID,
    MALFORMED_ID
} from './helpers/index.js';

describe('Orders API (/api/orders)', () => {
    let customer;

    // cada test arranca con las colecciones vacías y con un cliente válido recién creado
    beforeEach(async () => {
        await clearDatabase();
        customer = await createUser();
    });

    describe('GET /api/orders', () => {
        it('responde 200 con un array vacío si no hay pedidos', async () => {
            const response = await request(app).get('/api/orders');

            const body = expectSuccess(response, 200);
            expect(body.payload).to.be.an('array').that.is.empty;
        });

        it('responde 200 con los pedidos, el cliente completado y sus propiedades principales', async () => {
            await createOrder(customer._id);
            await createOrder(customer._id, { priority: DELIVERY_PRIORITY.HIGH });

            const response = await request(app).get('/api/orders');

            const body = expectSuccess(response, 200);
            expect(body.payload).to.be.an('array').with.lengthOf(2);
            body.payload.forEach((order) => {
                expect(order).to.include.all.keys(
                    '_id', 'customer', 'items', 'deliveryAddress', 'total', 'shippingCost', 'status', 'priority', 'delivery'
                );
                expect(order.items).to.be.an('array').with.lengthOf(ORDER_ITEMS.length);
                expect(order.status).to.equal(ORDER_STATUS.CREATED);
                expect(order.delivery).to.be.null;
                // el cliente viene completado (populate) con sus datos básicos
                expect(order.customer).to.include({ _id: customer._id.toString(), email: customer.email });
                expect(order.customer).to.include.all.keys('firstName', 'lastName');
            });
            expect(body.payload.map((order) => order.priority)).to.have.members([
                DELIVERY_PRIORITY.NORMAL,
                DELIVERY_PRIORITY.HIGH
            ]);
        });
    });

    describe('POST /api/orders', () => {
        it('responde 201 y crea el pedido con los valores calculados por el servidor', async () => {
            const orderData = buildOrderData(customer._id);

            const response = await request(app).post('/api/orders').send(orderData);

            const body = expectSuccess(response, 201);
            const order = body.payload;
            expect(order).to.include.all.keys(
                '_id', 'customer', 'items', 'deliveryAddress', 'declaredValue', 'shippingCost', 'total', 'status', 'priority'
            );
            expect(order.customer).to.equal(customer._id.toString());
            expect(order.deliveryAddress).to.equal(orderData.deliveryAddress);
            expect(order.items).to.deep.equal(orderData.items);
            expect(order.status).to.equal(ORDER_STATUS.CREATED); // siempre arranca en created
            expect(order.priority).to.equal(DELIVERY_PRIORITY.NORMAL);
            expect(order.declaredValue).to.equal(ORDER_ITEMS_TOTAL);
            expect(order.shippingCost).to.equal(SHIPPING_COST_OUTSIDE_PRODUCTION);
            expect(order.total).to.equal(ORDER_ITEMS_TOTAL + SHIPPING_COST_OUTSIDE_PRODUCTION);

            // no alcanza con la respuesta: se verifica que quedó guardado
            const saved = await Order.findById(order._id);
            expect(saved).to.not.be.null;
            expect(saved.customer.toString()).to.equal(customer._id.toString());
        });

        it('usa la prioridad normal y el estado created si no se indican', async () => {
            const { priority, ...withoutPriority } = buildOrderData(customer._id);

            const response = await request(app)
                .post('/api/orders')
                .send({ ...withoutPriority, status: ORDER_STATUS.DELIVERED }); // el estado enviado se ignora

            const body = expectSuccess(response, 201);
            expect(body.payload.priority).to.equal(DELIVERY_PRIORITY.NORMAL);
            expect(body.payload.status).to.equal(ORDER_STATUS.CREATED);
        });

        it('respeta la prioridad indicada', async () => {
            const response = await request(app)
                .post('/api/orders')
                .send(buildOrderData(customer._id, { priority: DELIVERY_PRIORITY.HIGH }));

            const body = expectSuccess(response, 201);
            expect(body.payload.priority).to.equal(DELIVERY_PRIORITY.HIGH);
        });

        it('responde 400 ORDER_WITHOUT_ITEMS si el pedido no tiene items', async () => {
            const { items, ...withoutItems } = buildOrderData(customer._id);

            const response = await request(app).post('/api/orders').send(withoutItems);

            expectApiError(response, 400, ErrorDictionary.ORDER_WITHOUT_ITEMS);
            expect(await Order.countDocuments()).to.equal(0);
        });

        it('responde 400 ORDER_WITHOUT_ITEMS si el array de items está vacío', async () => {
            const response = await request(app)
                .post('/api/orders')
                .send(buildOrderData(customer._id, { items: [] }));

            expectApiError(response, 400, ErrorDictionary.ORDER_WITHOUT_ITEMS);
            expect(await Order.countDocuments()).to.equal(0);
        });

        it('responde 400 INVALID_ORDER_ITEMS si un item tiene nombre vacío, cantidad 0 o precio negativo', async () => {
            const response = await request(app)
                .post('/api/orders')
                .send(buildOrderData(customer._id, { items: [{ name: '', quantity: 0, price: -1 }] }));

            const body = expectApiError(response, 400, ErrorDictionary.INVALID_ORDER_ITEMS);
            expect(body.details.map((detail) => detail.field)).to.have.members([
                'items[0].name',
                'items[0].quantity',
                'items[0].price'
            ]);
            expect(await Order.countDocuments()).to.equal(0);
        });

        it('responde 400 VALIDATION_ERROR si falta la dirección de entrega', async () => {
            const { deliveryAddress, ...withoutAddress } = buildOrderData(customer._id);

            const response = await request(app).post('/api/orders').send(withoutAddress);

            const body = expectApiError(response, 400, ErrorDictionary.VALIDATION_ERROR);
            expect(findDetail(body, 'deliveryAddress')).to.deep.equal({
                field: 'deliveryAddress',
                message: 'La dirección de entrega es obligatoria'
            });
            expect(await Order.countDocuments()).to.equal(0);
        });

        it('responde 400 INVALID_PRIORITY si la prioridad no es válida', async () => {
            const response = await request(app)
                .post('/api/orders')
                .send(buildOrderData(customer._id, { priority: 'urgentisima' }));

            const body = expectApiError(response, 400, ErrorDictionary.INVALID_PRIORITY);
            expect(body.details).to.deep.equal([
                { field: 'priority', received: 'urgentisima', allowed: Object.values(DELIVERY_PRIORITY) }
            ]);
            expect(await Order.countDocuments()).to.equal(0);
        });

        it('responde 404 CUSTOMER_NOT_FOUND si el cliente no existe', async () => {
            const response = await request(app)
                .post('/api/orders')
                .send(buildOrderData(NON_EXISTENT_ID));

            expectApiError(response, 404, ErrorDictionary.CUSTOMER_NOT_FOUND);
            expect(await Order.countDocuments()).to.equal(0);
        });

        it('responde 400 INVALID_ID si el id del cliente no tiene formato válido', async () => {
            const response = await request(app)
                .post('/api/orders')
                .send(buildOrderData(MALFORMED_ID));

            const body = expectApiError(response, 400, ErrorDictionary.INVALID_ID);
            expect(body.details).to.deep.equal([{ field: '_id', received: MALFORMED_ID }]);
        });

        it('responde 400 INVALID_JSON si el body está mal formado', async () => {
            const response = await request(app)
                .post('/api/orders')
                .set('Content-Type', 'application/json')
                .send('{"customer": ');

            expectApiError(response, 400, ErrorDictionary.INVALID_JSON);
        });
    });

    describe('GET /api/orders/:id', () => {
        it('responde 200 con el pedido, el cliente y la entrega completados', async () => {
            const order = await createOrder(customer._id);

            const response = await request(app).get(`/api/orders/${order._id}`);

            const body = expectSuccess(response, 200);
            expect(body.payload).to.be.an('object');
            expect(body.payload._id).to.equal(order._id.toString());
            expect(body.payload.deliveryAddress).to.equal(order.deliveryAddress);
            expect(body.payload.status).to.equal(ORDER_STATUS.CREATED);
            expect(body.payload.total).to.equal(ORDER_ITEMS_TOTAL + SHIPPING_COST_OUTSIDE_PRODUCTION);
            expect(body.payload.items).to.deep.equal(ORDER_ITEMS.map((item) => ({ ...item })));
            expect(body.payload.customer).to.include({ _id: customer._id.toString(), email: customer.email });
            expect(body.payload.delivery).to.be.null;
        });

        it('responde 404 ORDER_NOT_FOUND si el pedido no existe', async () => {
            const response = await request(app).get(`/api/orders/${NON_EXISTENT_ID}`);

            const body = expectApiError(response, 404, ErrorDictionary.ORDER_NOT_FOUND);
            expect(body.details).to.deep.equal([]);
        });

        it('responde 400 INVALID_ID si el id no tiene formato de ObjectId', async () => {
            const response = await request(app).get(`/api/orders/${MALFORMED_ID}`);

            const body = expectApiError(response, 400, ErrorDictionary.INVALID_ID);
            expect(body.details).to.deep.equal([{ field: '_id', received: MALFORMED_ID }]);
        });
    });

    describe('PUT /api/orders/:id (actualizar estado)', () => {
        // un test por cada estado permitido: si se agrega un estado a las constantes, se prueba solo
        Object.values(ORDER_STATUS).forEach((status) => {
            it(`responde 200 y cambia el estado a "${status}"`, async () => {
                const order = await createOrder(customer._id);

                const response = await request(app)
                    .put(`/api/orders/${order._id}`)
                    .send({ status });

                const body = expectSuccess(response, 200);
                expect(body.payload._id).to.equal(order._id.toString());
                expect(body.payload.status).to.equal(status);

                const saved = await Order.findById(order._id);
                expect(saved.status).to.equal(status);
            });
        });

        it('responde 200 y cambia la prioridad sin tocar el resto del pedido', async () => {
            const order = await createOrder(customer._id);

            const response = await request(app)
                .put(`/api/orders/${order._id}`)
                .send({ priority: DELIVERY_PRIORITY.HIGH });

            const body = expectSuccess(response, 200);
            expect(body.payload.priority).to.equal(DELIVERY_PRIORITY.HIGH);
            expect(body.payload.status).to.equal(ORDER_STATUS.CREATED);
            expect(body.payload.deliveryAddress).to.equal(order.deliveryAddress);
        });

        it('responde 400 INVALID_ORDER_STATUS si el estado no es válido y no modifica el pedido', async () => {
            const order = await createOrder(customer._id);

            const response = await request(app)
                .put(`/api/orders/${order._id}`)
                .send({ status: 'volando' });

            const body = expectApiError(response, 400, ErrorDictionary.INVALID_ORDER_STATUS);
            expect(body.details).to.deep.equal([
                { field: 'status', received: 'volando', allowed: Object.values(ORDER_STATUS) }
            ]);

            const saved = await Order.findById(order._id);
            expect(saved.status).to.equal(ORDER_STATUS.CREATED);
        });

        it('responde 400 INVALID_PRIORITY si la prioridad no es válida', async () => {
            const order = await createOrder(customer._id);

            const response = await request(app)
                .put(`/api/orders/${order._id}`)
                .send({ priority: 'urgentisima' });

            expectApiError(response, 400, ErrorDictionary.INVALID_PRIORITY);
        });

        it('responde 400 ORDER_WITHOUT_ITEMS si se envía un array de items vacío', async () => {
            const order = await createOrder(customer._id);

            const response = await request(app)
                .put(`/api/orders/${order._id}`)
                .send({ items: [] });

            expectApiError(response, 400, ErrorDictionary.ORDER_WITHOUT_ITEMS);
        });

        it('responde 400 INVALID_ORDER_ITEMS si se envían items inválidos', async () => {
            const order = await createOrder(customer._id);

            const response = await request(app)
                .put(`/api/orders/${order._id}`)
                .send({ items: [{ name: 'Termo', quantity: 1, price: -5 }] });

            const body = expectApiError(response, 400, ErrorDictionary.INVALID_ORDER_ITEMS);
            expect(body.details).to.deep.equal([
                { field: 'items[0].price', message: 'El precio debe ser un número mayor o igual a 0' }
            ]);
        });

        it('responde 404 ORDER_NOT_FOUND si el pedido no existe', async () => {
            const response = await request(app)
                .put(`/api/orders/${NON_EXISTENT_ID}`)
                .send({ status: ORDER_STATUS.ASSIGNED });

            expectApiError(response, 404, ErrorDictionary.ORDER_NOT_FOUND);
        });

        it('responde 400 INVALID_ID si el id no tiene formato de ObjectId', async () => {
            const response = await request(app)
                .put(`/api/orders/${MALFORMED_ID}`)
                .send({ status: ORDER_STATUS.ASSIGNED });

            expectApiError(response, 400, ErrorDictionary.INVALID_ID);
        });

        it('responde 400 INVALID_JSON si el body está mal formado', async () => {
            const order = await createOrder(customer._id);

            const response = await request(app)
                .put(`/api/orders/${order._id}`)
                .set('Content-Type', 'application/json')
                .send('{"status": ');

            expectApiError(response, 400, ErrorDictionary.INVALID_JSON);
        });
    });

    describe('DELETE /api/orders/:id', () => {
        it('responde 200 y elimina el pedido', async () => {
            const order = await createOrder(customer._id);

            const response = await request(app).delete(`/api/orders/${order._id}`);

            const body = expectSuccess(response, 200);
            expect(body.message).to.equal('Pedido eliminado');
            expect(await Order.findById(order._id)).to.be.null;
        });

        it('responde 404 ORDER_NOT_FOUND si el pedido no existe', async () => {
            const response = await request(app).delete(`/api/orders/${NON_EXISTENT_ID}`);

            expectApiError(response, 404, ErrorDictionary.ORDER_NOT_FOUND);
        });

        it('responde 400 INVALID_ID si el id no tiene formato de ObjectId', async () => {
            const response = await request(app).delete(`/api/orders/${MALFORMED_ID}`);

            expectApiError(response, 400, ErrorDictionary.INVALID_ID);
        });
    });
});
