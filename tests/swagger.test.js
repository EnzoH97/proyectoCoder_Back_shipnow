import { expect } from 'chai';
import request from 'supertest';
import app from '../src/app.js';
import { ErrorDictionary } from '../src/utils/errors.js';
import {
    clearDatabase,
    createUser,
    buildOrderData,
    expectApiError,
    NON_EXISTENT_ID
} from './helpers/index.js';

const DOCUMENTED_OPERATIONS = [
    ['get', '/api/users'], ['post', '/api/users'],
    ['get', '/api/users/{id}'], ['put', '/api/users/{id}'], ['delete', '/api/users/{id}'],
    ['get', '/api/orders'], ['post', '/api/orders'],
    ['get', '/api/orders/{id}'], ['put', '/api/orders/{id}'], ['delete', '/api/orders/{id}'],
    ['get', '/api/deliveries'], ['post', '/api/deliveries'],
    ['get', '/api/deliveries/{id}'], ['put', '/api/deliveries/{id}'], ['delete', '/api/deliveries/{id}'],
    ['get', '/api/mocks/users'], ['get', '/api/mocks/drivers'], ['get', '/api/mocks/orders'],
    ['get', '/api/mocks/deliveries'], ['get', '/api/mocks/dataset'], ['post', '/api/mocks/seed'],
    ['get', '/api/logger/test']
];

describe('Swagger (/api/docs)', () => {
    describe('GET /api/docs/ (Swagger UI)', () => {
        it('responde 200 con la página HTML de Swagger UI', async () => {
            const response = await request(app).get('/api/docs/');

            expect(response.status).to.equal(200);
            expect(response.headers['content-type']).to.include('text/html');
            expect(response.text).to.include('swagger-ui');
            expect(response.text).to.include('ShipNow API');
        });

        it('sirve los archivos estáticos que necesita la interfaz', async () => {
            const response = await request(app).get('/api/docs/swagger-ui-bundle.js');

            expect(response.status).to.equal(200);
            expect(response.headers['content-type']).to.include('javascript');
        });
    });

    describe('GET /api/docs.json (especificación OpenAPI)', () => {
        let spec;

        before(async () => {
            const response = await request(app).get('/api/docs.json');
            expect(response.status).to.equal(200);
            expect(response.headers['content-type']).to.match(/application\/json/);
            spec = response.body;
        });

        it('responde 200 con una especificación OpenAPI 3 con la información general de la API', () => {
            expect(spec).to.include.all.keys('openapi', 'info', 'servers', 'tags', 'paths', 'components');
            expect(spec.openapi).to.match(/^3\./);
            expect(spec.info).to.include({ title: 'ShipNow API', version: '1.0.0' });
            expect(spec.tags.map((tag) => tag.name)).to.have.members(['Users', 'Orders', 'Deliveries', 'Mocks', 'Logger']);
        });

        it('documenta los 22 endpoints, cada uno con su tag y una respuesta exitosa', () => {
            DOCUMENTED_OPERATIONS.forEach(([method, path]) => {
                const operation = spec.paths?.[path]?.[method];
                expect(operation, `${method.toUpperCase()} ${path} está documentado`).to.be.an('object');
                expect(operation.tags, `${method.toUpperCase()} ${path} tiene tag`).to.be.an('array').that.is.not.empty;
                const successCodes = Object.keys(operation.responses).filter((code) => code.startsWith('2'));
                expect(successCodes, `${method.toUpperCase()} ${path} documenta una respuesta 2xx`).to.not.be.empty;
            });
        });

        it('define el schema de error uniforme con status, code, message y details', () => {
            const errorResponse = spec.components.schemas.ErrorResponse;
            expect(errorResponse).to.be.an('object');
            expect(errorResponse.properties).to.include.all.keys('status', 'code', 'message', 'details');
        });

        it('el enum de códigos de error documentado coincide con el diccionario de errores', () => {
            const documentedCodes = spec.components.schemas.ErrorCode.enum;
            const dictionaryCodes = Object.values(ErrorDictionary).map((error) => error.code);
            expect(documentedCodes).to.have.members(dictionaryCodes);
        });
    });

    describe('métodos no definidos en las rutas de documentación', () => {
        it('POST /api/docs.json responde 404 ROUTE_NOT_FOUND', async () => {
            const response = await request(app).post('/api/docs.json').send({});

            const body = expectApiError(response, 404, ErrorDictionary.ROUTE_NOT_FOUND);
            expect(body.details).to.deep.equal([{ method: 'POST', path: '/api/docs.json' }]);
        });
    });

    describe('Coherencia con Swagger: los errores documentados coinciden con los reales', () => {
        let spec;

        const resolveResponse = (response) => (
            response.$ref ? spec.components.responses[response.$ref.split('/').pop()] : response
        );
        const exampleOf = (response) => resolveResponse(response).content['application/json'].example;
        const examplesOf = (response) => resolveResponse(response).content['application/json'].examples;

        before(async () => {
            const response = await request(app).get('/api/docs.json');
            spec = response.body;
        });

        beforeEach(clearDatabase);

        [
            { resource: 'users', path: '/api/users/{id}' },
            { resource: 'orders', path: '/api/orders/{id}' },
            { resource: 'deliveries', path: '/api/deliveries/{id}' }
        ].forEach(({ resource, path }) => {
            it(`GET ${path}: el 404 documentado es el que devuelve la API`, async () => {
                const documented = exampleOf(spec.paths[path].get.responses['404']);

                const response = await request(app).get(`/api/${resource}/${NON_EXISTENT_ID}`);

                expect(response.status).to.equal(404);
                expect(response.body).to.deep.equal(documented);
            });

            it(`GET ${path}: el 400 documentado (INVALID_ID) es el que devuelve la API`, async () => {
                const documented = exampleOf(spec.paths[path].get.responses['400']);
                const sentId = documented.details[0].received;

                const response = await request(app).get(`/api/${resource}/${sentId}`);

                expect(response.status).to.equal(400);
                expect(response.body).to.deep.equal(documented);
            });
        });

        it('GET /api/mocks/users: los 400 documentados de qty coinciden con los reales', async () => {
            const documentedExamples = examplesOf(spec.paths['/api/mocks/users'].get.responses['400']);
            expect(Object.keys(documentedExamples)).to.have.members(['QTY_NOT_INTEGER', 'QTY_NEGATIVE', 'QTY_OUT_OF_RANGE']);

            for (const [code, example] of Object.entries(documentedExamples)) {
                const qty = example.value.details[0].received;

                const response = await request(app).get(`/api/mocks/users?qty=${encodeURIComponent(qty)}`);

                expect(response.status, `status de ${code}`).to.equal(400);
                expect(response.body, `cuerpo de ${code}`).to.deep.equal(example.value);
            }
        });

        it('POST /api/mocks/seed: el 400 de colección inexistente coincide con el real', async () => {
            const documented = examplesOf(spec.paths['/api/mocks/seed'].post.responses['400']).INVALID_MOCK_COLLECTION.value;

            const response = await request(app).post(`/api/mocks/seed?collection=${documented.details[0].received}`);

            expect(response.status).to.equal(400);
            expect(response.body).to.deep.equal(documented);
        });

        it('POST /api/mocks/seed: los 409 documentados (sin datos previos) coinciden con los reales', async () => {
            const documentedExamples = examplesOf(spec.paths['/api/mocks/seed'].post.responses['409']);
            const cases = { NO_CUSTOMERS_FOR_MOCK: 'orders', NO_PENDING_ORDERS_FOR_MOCK: 'deliveries' };

            for (const [code, collection] of Object.entries(cases)) {
                const response = await request(app).post(`/api/mocks/seed?collection=${collection}`);

                expect(response.status, `status de ${code}`).to.equal(409);
                expect(response.body, `cuerpo de ${code}`).to.deep.equal(documentedExamples[code].value);
            }
        });

        it('POST /api/orders: los 400 y el 404 documentados coinciden con los reales', async () => {
            const customer = await createUser();
            const post = spec.paths['/api/orders'].post.responses;
            const documented400 = examplesOf(post['400']);
            const requests = {
                ORDER_WITHOUT_ITEMS: buildOrderData(customer._id, { items: [] }),
                INVALID_ORDER_ITEMS: buildOrderData(customer._id, { items: [{ name: 'Termo', quantity: 1, price: -5 }] }),
                INVALID_PRIORITY: buildOrderData(customer._id, { priority: 'urgentisima' }),
                VALIDATION_ERROR: buildOrderData(customer._id, { deliveryAddress: undefined }),
                INVALID_ID: buildOrderData('abc')
            };

            for (const [code, orderData] of Object.entries(requests)) {
                const response = await request(app).post('/api/orders').send(orderData);

                expect(response.status, `status de ${code}`).to.equal(400);
                expect(response.body, `cuerpo de ${code}`).to.deep.equal(documented400[code].value);
            }

            const notFound = await request(app).post('/api/orders').send(buildOrderData(NON_EXISTENT_ID));
            expect(notFound.status).to.equal(404);
            expect(notFound.body).to.deep.equal(exampleOf(post['404']));
        });

        it('PUT /api/orders/{id}: el 400 documentado de estado inválido coincide con el real', async () => {
            const documented = examplesOf(spec.paths['/api/orders/{id}'].put.responses['400']).INVALID_ORDER_STATUS.value;

            const response = await request(app)
                .put(`/api/orders/${NON_EXISTENT_ID}`)
                .send({ status: documented.details[0].received });

            expect(response.status).to.equal(400);
            expect(response.body).to.deep.equal(documented);
        });
    });
});
