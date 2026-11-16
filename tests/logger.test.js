import { expect } from 'chai';
import request from 'supertest';
import app from '../src/app.js';
import logger from '../src/utils/logger.js';
import { ErrorDictionary } from '../src/utils/errors.js';
import { LOG_LEVELS, LOG_LEVEL_PRIORITIES } from '../src/constants/constants.js';
import { expectSuccess, expectApiError } from './helpers/index.js';

// Orden en el que el endpoint genera los mensajes (de menos a más grave)
const EXPECTED_ORDER = [
    LOG_LEVELS.DEBUG,
    LOG_LEVELS.HTTP,
    LOG_LEVELS.INFO,
    LOG_LEVELS.WARNING,
    LOG_LEVELS.ERROR,
    LOG_LEVELS.FATAL
];

describe('Logger API (/api/logger/test)', () => {
    describe('GET /api/logger/test', () => {
        it('responde 200 con el nivel activo y un mensaje por cada nivel', async () => {
            const response = await request(app).get('/api/logger/test');

            const body = expectSuccess(response, 200);
            expect(body.payload).to.have.all.keys('activeLevel', 'levels');
            expect(body.payload.activeLevel).to.equal(logger.level);
            expect(body.payload.activeLevel).to.be.oneOf(Object.values(LOG_LEVELS));

            expect(body.payload.levels).to.be.an('array').with.lengthOf(EXPECTED_ORDER.length);
            expect(body.payload.levels.map((entry) => entry.level)).to.deep.equal(EXPECTED_ORDER);
            body.payload.levels.forEach((entry) => {
                expect(entry).to.have.all.keys('level', 'message', 'registered');
                expect(entry.message).to.equal(`[logger-test] Mensaje de prueba de nivel ${entry.level}`);
                expect(entry.registered).to.be.a('boolean');
            });
        });

        it('indica como registrados solo los niveles que habilita el nivel activo', async () => {
            const response = await request(app).get('/api/logger/test');

            const { activeLevel, levels } = expectSuccess(response, 200).payload;
            levels.forEach((entry) => {
                const expected = LOG_LEVEL_PRIORITIES[entry.level] <= LOG_LEVEL_PRIORITIES[activeLevel];
                expect(entry.registered, `nivel ${entry.level} con nivel activo ${activeLevel}`).to.equal(expected);
            });
            // fatal es el nivel más grave: siempre se registra
            expect(levels.find((entry) => entry.level === LOG_LEVELS.FATAL).registered).to.be.true;
        });

        it('responde igual en llamadas consecutivas (no depende de llamadas anteriores)', async () => {
            const first = await request(app).get('/api/logger/test');
            const second = await request(app).get('/api/logger/test');

            expect(second.status).to.equal(200);
            expect(second.body).to.deep.equal(first.body);
        });
    });

    describe('métodos no definidos en /api/logger/test', () => {
        it('responde 404 ROUTE_NOT_FOUND ante un POST', async () => {
            const response = await request(app).post('/api/logger/test').send({});

            const body = expectApiError(response, 404, ErrorDictionary.ROUTE_NOT_FOUND);
            expect(body.details).to.deep.equal([{ method: 'POST', path: '/api/logger/test' }]);
        });
    });

    describe('rutas inexistentes dentro de /api/logger', () => {
        it('responde 404 ROUTE_NOT_FOUND', async () => {
            const response = await request(app).get('/api/logger/no-existe');

            const body = expectApiError(response, 404, ErrorDictionary.ROUTE_NOT_FOUND);
            expect(body.details).to.deep.equal([{ method: 'GET', path: '/api/logger/no-existe' }]);
        });
    });
});
