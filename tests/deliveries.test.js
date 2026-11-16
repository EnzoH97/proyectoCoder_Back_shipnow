import { expect } from 'chai';
import request from 'supertest';
import app from '../src/app.js';
import Delivery from '../src/models/delivery.model.js';
import { ErrorDictionary } from '../src/utils/errors.js';
import { DELIVERY_STATUS, DELIVERY_PRIORITY } from '../src/constants/constants.js';
import {
    clearDatabase,
    createUser,
    createDriver,
    createOrder,
    createDelivery,
    expectSuccess,
    expectApiError,
    NON_EXISTENT_ID,
    MALFORMED_ID
} from './helpers/index.js';

describe('Deliveries API (/api/deliveries)', () => {
    let customer;
    let driver;
    let order;

    // cada test arranca con las colecciones vacías, un cliente, un repartidor y un pedido recién creados
    beforeEach(async () => {
        await clearDatabase();
        customer = await createUser();
        driver = await createDriver();
        order = await createOrder(customer._id);
    });

    describe('GET /api/deliveries', () => {
        it('responde 200 con un array vacío si no hay entregas', async () => {
            const response = await request(app).get('/api/deliveries');

            const body = expectSuccess(response, 200);
            expect(body.payload).to.be.an('array').that.is.empty;
        });

        it('responde 200 con las entregas, el pedido y el repartidor completados', async () => {
            await createDelivery(order._id, { driver: driver._id, status: DELIVERY_STATUS.ASSIGNED });

            const response = await request(app).get('/api/deliveries');

            const body = expectSuccess(response, 200);
            expect(body.payload).to.be.an('array').with.lengthOf(1);
            const [delivery] = body.payload;
            expect(delivery).to.include.all.keys('_id', 'order', 'driver', 'status', 'priority');
            expect(delivery.status).to.equal(DELIVERY_STATUS.ASSIGNED);
            expect(delivery.order).to.include({ _id: order._id.toString() });
            expect(delivery.driver).to.include({ _id: driver._id.toString(), email: driver.email });
        });
    });

    describe('POST /api/deliveries', () => {
        it('responde 201 y crea la entrega con un repartidor', async () => {
            const response = await request(app).post('/api/deliveries').send({
                order: order._id.toString(),
                driver: driver._id.toString(),
                status: DELIVERY_STATUS.ASSIGNED,
                priority: DELIVERY_PRIORITY.HIGH
            });

            const body = expectSuccess(response, 201);
            expect(body.payload).to.include.all.keys('_id', 'order', 'driver', 'status', 'priority');
            expect(body.payload.order).to.equal(order._id.toString());
            expect(body.payload.driver).to.equal(driver._id.toString());
            expect(body.payload.status).to.equal(DELIVERY_STATUS.ASSIGNED);
            expect(body.payload.priority).to.equal(DELIVERY_PRIORITY.HIGH);

            // no alcanza con la respuesta: se verifica que quedó guardada
            expect(await Delivery.findById(body.payload._id)).to.not.be.null;
        });

        it('responde 201 con estado pending, prioridad normal y sin repartidor si no se indican', async () => {
            const response = await request(app)
                .post('/api/deliveries')
                .send({ order: order._id.toString() });

            const body = expectSuccess(response, 201);
            expect(body.payload.order).to.equal(order._id.toString());
            expect(body.payload.driver).to.be.null;
            expect(body.payload.status).to.equal(DELIVERY_STATUS.PENDING);
            expect(body.payload.priority).to.equal(DELIVERY_PRIORITY.NORMAL);
        });

        it('responde 404 ORDER_NOT_FOUND si el pedido no existe', async () => {
            const response = await request(app)
                .post('/api/deliveries')
                .send({ order: NON_EXISTENT_ID });

            expectApiError(response, 404, ErrorDictionary.ORDER_NOT_FOUND);
            expect(await Delivery.countDocuments()).to.equal(0);
        });

        it('responde 404 DRIVER_NOT_FOUND si el repartidor no existe', async () => {
            const response = await request(app)
                .post('/api/deliveries')
                .send({ order: order._id.toString(), driver: NON_EXISTENT_ID });

            expectApiError(response, 404, ErrorDictionary.DRIVER_NOT_FOUND);
            expect(await Delivery.countDocuments()).to.equal(0);
        });

        it('responde 400 USER_NOT_DRIVER si el usuario indicado no tiene rol driver', async () => {
            const response = await request(app)
                .post('/api/deliveries')
                .send({ order: order._id.toString(), driver: customer._id.toString() });

            expectApiError(response, 400, ErrorDictionary.USER_NOT_DRIVER);
            expect(await Delivery.countDocuments()).to.equal(0);
        });

        it('responde 400 INVALID_DELIVERY_STATUS si el estado no es válido', async () => {
            const response = await request(app)
                .post('/api/deliveries')
                .send({ order: order._id.toString(), status: 'volando' });

            const body = expectApiError(response, 400, ErrorDictionary.INVALID_DELIVERY_STATUS);
            expect(body.details).to.deep.equal([
                { field: 'status', received: 'volando', allowed: Object.values(DELIVERY_STATUS) }
            ]);
            expect(await Delivery.countDocuments()).to.equal(0);
        });

        it('responde 400 INVALID_PRIORITY si la prioridad no es válida', async () => {
            const response = await request(app)
                .post('/api/deliveries')
                .send({ order: order._id.toString(), priority: 'urgentisima' });

            expectApiError(response, 400, ErrorDictionary.INVALID_PRIORITY);
        });

        it('responde 400 INVALID_ID si el id del pedido no tiene formato válido', async () => {
            const response = await request(app)
                .post('/api/deliveries')
                .send({ order: MALFORMED_ID });

            expectApiError(response, 400, ErrorDictionary.INVALID_ID);
        });

        it('responde 400 INVALID_JSON si el body está mal formado', async () => {
            const response = await request(app)
                .post('/api/deliveries')
                .set('Content-Type', 'application/json')
                .send('{"order": ');

            expectApiError(response, 400, ErrorDictionary.INVALID_JSON);
        });
    });

    describe('GET /api/deliveries/:id', () => {
        it('responde 200 con la entrega, el pedido y el repartidor completados', async () => {
            const delivery = await createDelivery(order._id, { driver: driver._id, status: DELIVERY_STATUS.ASSIGNED });

            const response = await request(app).get(`/api/deliveries/${delivery._id}`);

            const body = expectSuccess(response, 200);
            expect(body.payload).to.be.an('object');
            expect(body.payload._id).to.equal(delivery._id.toString());
            expect(body.payload.status).to.equal(DELIVERY_STATUS.ASSIGNED);
            expect(body.payload.order).to.include({ _id: order._id.toString() });
            expect(body.payload.driver).to.include({ _id: driver._id.toString(), email: driver.email });
        });

        it('responde 404 DELIVERY_NOT_FOUND si la entrega no existe', async () => {
            const response = await request(app).get(`/api/deliveries/${NON_EXISTENT_ID}`);

            const body = expectApiError(response, 404, ErrorDictionary.DELIVERY_NOT_FOUND);
            expect(body.details).to.deep.equal([]);
        });

        it('responde 400 INVALID_ID si el id no tiene formato de ObjectId', async () => {
            const response = await request(app).get(`/api/deliveries/${MALFORMED_ID}`);

            const body = expectApiError(response, 400, ErrorDictionary.INVALID_ID);
            expect(body.details).to.deep.equal([{ field: '_id', received: MALFORMED_ID }]);
        });
    });

    describe('PUT /api/deliveries/:id (actualizar estado)', () => {
        // un test por cada estado permitido: si se agrega un estado a las constantes, se prueba solo
        Object.values(DELIVERY_STATUS).forEach((status) => {
            it(`responde 200 y cambia el estado a "${status}"`, async () => {
                const delivery = await createDelivery(order._id);

                const response = await request(app)
                    .put(`/api/deliveries/${delivery._id}`)
                    .send({ status });

                const body = expectSuccess(response, 200);
                expect(body.payload._id).to.equal(delivery._id.toString());
                expect(body.payload.status).to.equal(status);

                const saved = await Delivery.findById(delivery._id);
                expect(saved.status).to.equal(status);
            });
        });

        it('responde 400 INVALID_DELIVERY_STATUS si el estado no es válido y no modifica la entrega', async () => {
            const delivery = await createDelivery(order._id);

            const response = await request(app)
                .put(`/api/deliveries/${delivery._id}`)
                .send({ status: 'volando' });

            const body = expectApiError(response, 400, ErrorDictionary.INVALID_DELIVERY_STATUS);
            expect(body.details).to.deep.equal([
                { field: 'status', received: 'volando', allowed: Object.values(DELIVERY_STATUS) }
            ]);

            const saved = await Delivery.findById(delivery._id);
            expect(saved.status).to.equal(DELIVERY_STATUS.PENDING);
        });

        it('responde 400 INVALID_PRIORITY si la prioridad no es válida', async () => {
            const delivery = await createDelivery(order._id);

            const response = await request(app)
                .put(`/api/deliveries/${delivery._id}`)
                .send({ priority: 'urgentisima' });

            expectApiError(response, 400, ErrorDictionary.INVALID_PRIORITY);
        });

        it('responde 404 DELIVERY_NOT_FOUND si la entrega no existe', async () => {
            const response = await request(app)
                .put(`/api/deliveries/${NON_EXISTENT_ID}`)
                .send({ status: DELIVERY_STATUS.IN_TRANSIT });

            expectApiError(response, 404, ErrorDictionary.DELIVERY_NOT_FOUND);
        });

        it('responde 400 INVALID_ID si el id no tiene formato de ObjectId', async () => {
            const response = await request(app)
                .put(`/api/deliveries/${MALFORMED_ID}`)
                .send({ status: DELIVERY_STATUS.IN_TRANSIT });

            expectApiError(response, 400, ErrorDictionary.INVALID_ID);
        });

        it('responde 400 INVALID_JSON si el body está mal formado', async () => {
            const delivery = await createDelivery(order._id);

            const response = await request(app)
                .put(`/api/deliveries/${delivery._id}`)
                .set('Content-Type', 'application/json')
                .send('{"status": ');

            expectApiError(response, 400, ErrorDictionary.INVALID_JSON);
        });
    });

    describe('DELETE /api/deliveries/:id', () => {
        it('responde 200 y elimina la entrega', async () => {
            const delivery = await createDelivery(order._id);

            const response = await request(app).delete(`/api/deliveries/${delivery._id}`);

            const body = expectSuccess(response, 200);
            expect(body.message).to.equal('Entrega eliminada');
            expect(await Delivery.findById(delivery._id)).to.be.null;
        });

        it('responde 404 DELIVERY_NOT_FOUND si la entrega no existe', async () => {
            const response = await request(app).delete(`/api/deliveries/${NON_EXISTENT_ID}`);

            expectApiError(response, 404, ErrorDictionary.DELIVERY_NOT_FOUND);
        });

        it('responde 400 INVALID_ID si el id no tiene formato de ObjectId', async () => {
            const response = await request(app).delete(`/api/deliveries/${MALFORMED_ID}`);

            expectApiError(response, 400, ErrorDictionary.INVALID_ID);
        });
    });
});
