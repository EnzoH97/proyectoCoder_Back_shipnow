import { expect } from 'chai';
import request from 'supertest';
import app from '../src/app.js';
import { ErrorDictionary } from '../src/utils/errors.js';
import { expectApiError } from './helpers/index.js';

describe('App: endpoints generales', () => {
    describe('GET /api/health', () => {
        it('responde 200 con status ok y un timestamp ISO válido', async () => {
            const response = await request(app).get('/api/health');

            expect(response.status).to.equal(200);
            expect(response.headers['content-type']).to.match(/application\/json/);
            expect(response.body).to.have.all.keys('status', 'timestamp');
            expect(response.body.status).to.equal('ok');
            expect(new Date(response.body.timestamp).toISOString()).to.equal(response.body.timestamp);
        });
    });

    describe('rutas inexistentes', () => {
        it('GET /api/ruta-que-no-existe responde 404 ROUTE_NOT_FOUND con el método y la ruta pedidos', async () => {
            const response = await request(app).get('/api/ruta-que-no-existe');

            const body = expectApiError(response, 404, ErrorDictionary.ROUTE_NOT_FOUND);
            expect(body.details).to.deep.equal([{ method: 'GET', path: '/api/ruta-que-no-existe' }]);
        });

        it('responde 404 ROUTE_NOT_FOUND también fuera de /api', async () => {
            const response = await request(app).get('/no-existe');

            const body = expectApiError(response, 404, ErrorDictionary.ROUTE_NOT_FOUND);
            expect(body.details).to.deep.equal([{ method: 'GET', path: '/no-existe' }]);
        });

        it('responde 404 ROUTE_NOT_FOUND si el método no está definido para una ruta que sí existe', async () => {
            const response = await request(app).delete('/api/users'); // solo existen GET y POST en /api/users

            const body = expectApiError(response, 404, ErrorDictionary.ROUTE_NOT_FOUND);
            expect(body.details).to.deep.equal([{ method: 'DELETE', path: '/api/users' }]);
        });

        it('responde 404 ROUTE_NOT_FOUND ante un recurso inexistente con id', async () => {
            const response = await request(app).get('/api/camiones/123');

            expectApiError(response, 404, ErrorDictionary.ROUTE_NOT_FOUND);
        });
    });
});
