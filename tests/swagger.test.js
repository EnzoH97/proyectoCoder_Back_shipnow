import { expect } from 'chai';
import request from 'supertest';
import app from '../src/app.js';
import { ErrorDictionary } from '../src/utils/errors.js';
import { USER_DOCUMENT_TYPES, DOCUMENT_TYPES } from '../src/constants/constants.js';
import {
    clearDatabase,
    createUser,
    createOrder,
    createDelivery,
    buildOrderData,
    expectApiError,
    NON_EXISTENT_ID,
    PDF_FILE,
    TEXT_FILE,
    attachOptions,
    oversizedFile,
    removeUploads
} from './helpers/index.js';

// Los 24 endpoints documentados (src/docs/*.yaml): los 22 del Módulo 5 y los 2 de carga de archivos del Módulo 7
const DOCUMENTED_OPERATIONS = [
    ['get', '/api/users'], ['post', '/api/users'],
    ['get', '/api/users/{id}'], ['put', '/api/users/{id}'], ['delete', '/api/users/{id}'],
    ['get', '/api/orders'], ['post', '/api/orders'],
    ['get', '/api/orders/{id}'], ['put', '/api/orders/{id}'], ['delete', '/api/orders/{id}'],
    ['get', '/api/deliveries'], ['post', '/api/deliveries'],
    ['get', '/api/deliveries/{id}'], ['put', '/api/deliveries/{id}'], ['delete', '/api/deliveries/{id}'],
    ['get', '/api/mocks/users'], ['get', '/api/mocks/drivers'], ['get', '/api/mocks/orders'],
    ['get', '/api/mocks/deliveries'], ['get', '/api/mocks/dataset'], ['post', '/api/mocks/seed'],
    ['get', '/api/logger/test'],
    ['post', '/api/users/{id}/documents'], ['post', '/api/deliveries/{id}/proofs']
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

        it('documenta los 24 endpoints, cada uno con su tag y una respuesta exitosa', () => {
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
        afterEach(removeUploads);

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

        it('los endpoints de carga están documentados como multipart/form-data con el campo de archivo obligatorio', () => {
            const documents = spec.paths['/api/users/{id}/documents'].post.requestBody;
            const documentSchema = documents.content['multipart/form-data'].schema;
            expect(documents.required).to.be.true;
            expect(documentSchema.required).to.deep.equal(['document']);
            expect(documentSchema.properties.document).to.include({ type: 'string', format: 'binary' });

            expect(documentSchema.properties.type.enum).to.deep.equal(USER_DOCUMENT_TYPES);
            expect(documentSchema.properties.type.default).to.equal(DOCUMENT_TYPES.USER_DOCUMENT);

            const proofs = spec.paths['/api/deliveries/{id}/proofs'].post.requestBody;
            const proofSchema = proofs.content['multipart/form-data'].schema;
            expect(proofs.required).to.be.true;
            expect(proofSchema.required).to.deep.equal(['proof']);
            expect(proofSchema.properties.proof).to.include({ type: 'string', format: 'binary' });
        });

        it('POST /api/users/{id}/documents: los errores documentados coinciden con los reales', async () => {
            const customer = await createUser();
            const responses = spec.paths['/api/users/{id}/documents'].post.responses;
            const documented400 = examplesOf(responses['400']);
            const send = (userId, { file = PDF_FILE, fieldName = 'document', type } = {}) => {
                const req = request(app).post(`/api/users/${userId}/documents`);
                if (type) req.field('type', type);
                return req.attach(fieldName, file.content, attachOptions(file));
            };

            const requests = {
                FILE_REQUIRED: () => request(app).post(`/api/users/${customer._id}/documents`).field('type', DOCUMENT_TYPES.USER_DOCUMENT),
                INVALID_FILE_TYPE: () => send(customer._id, { file: TEXT_FILE }),
                INVALID_DOCUMENT_TYPE: () => send(customer._id, { type: documented400.INVALID_DOCUMENT_TYPE.value.details[0].received }),
                UNEXPECTED_FILE_FIELD: () => send(customer._id, { fieldName: documented400.UNEXPECTED_FILE_FIELD.value.details[0].field }),
                USER_NOT_DRIVER: () => send(customer._id, { type: DOCUMENT_TYPES.DRIVER_LICENSE }),
                INVALID_ID: () => send(documented400.INVALID_ID.value.details[0].received)
            };
            expect(Object.keys(documented400)).to.have.members(Object.keys(requests));

            for (const [code, makeRequest] of Object.entries(requests)) {
                const response = await makeRequest();
                expect(response.status, `status de ${code}`).to.equal(400);
                expect(response.body, `cuerpo de ${code}`).to.deep.equal(documented400[code].value);
            }

            const notFound = await send(NON_EXISTENT_ID);
            expect(notFound.status).to.equal(404);
            expect(notFound.body).to.deep.equal(exampleOf(responses['404']));

            const tooLarge = await send(customer._id, { file: oversizedFile() });
            expect(tooLarge.status).to.equal(413);
            expect(tooLarge.body).to.deep.equal(exampleOf(responses['413']));
        });

        it('POST /api/deliveries/{id}/proofs: los errores documentados coinciden con los reales', async () => {
            const customer = await createUser();
            const order = await createOrder(customer._id);
            const delivery = await createDelivery(order._id);
            const responses = spec.paths['/api/deliveries/{id}/proofs'].post.responses;
            const documented400 = examplesOf(responses['400']);
            const send = (deliveryId, { file = PDF_FILE, fieldName = 'proof' } = {}) => (
                request(app)
                    .post(`/api/deliveries/${deliveryId}/proofs`)
                    .attach(fieldName, file.content, attachOptions(file))
            );

            const requests = {
                FILE_REQUIRED: () => request(app).post(`/api/deliveries/${delivery._id}/proofs`).field('nota', 'sin archivo'),
                INVALID_FILE_TYPE: () => send(delivery._id, { file: TEXT_FILE }),
                UNEXPECTED_FILE_FIELD: () => send(delivery._id, { fieldName: documented400.UNEXPECTED_FILE_FIELD.value.details[0].field }),
                INVALID_ID: () => send(documented400.INVALID_ID.value.details[0].received)
            };
            expect(Object.keys(documented400)).to.have.members(Object.keys(requests));

            for (const [code, makeRequest] of Object.entries(requests)) {
                const response = await makeRequest();
                expect(response.status, `status de ${code}`).to.equal(400);
                expect(response.body, `cuerpo de ${code}`).to.deep.equal(documented400[code].value);
            }

            const notFound = await send(NON_EXISTENT_ID);
            expect(notFound.status).to.equal(404);
            expect(notFound.body).to.deep.equal(exampleOf(responses['404']));

            const tooLarge = await send(delivery._id, { file: oversizedFile() });
            expect(tooLarge.status).to.equal(413);
            expect(tooLarge.body).to.deep.equal(exampleOf(responses['413']));
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
