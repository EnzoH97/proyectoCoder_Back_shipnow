import { expect } from 'chai';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/user.model.js';
import { ErrorDictionary } from '../src/utils/errors.js';
import { USER_ROLES } from '../src/constants/constants.js';
import {
    clearDatabase,
    buildUserData,
    createUser,
    expectSuccess,
    expectApiError,
    findDetail,
    NON_EXISTENT_ID,
    MALFORMED_ID
} from './helpers/index.js';

describe('Users API (/api/users)', () => {
    // cada test arranca con las colecciones vacías: tests independientes y repetibles
    beforeEach(clearDatabase);

    describe('GET /api/users', () => {
        it('responde 200 con un array vacío si no hay usuarios', async () => {
            const response = await request(app).get('/api/users');

            const body = expectSuccess(response, 200);
            expect(body.payload).to.be.an('array').that.is.empty;
        });

        it('responde 200 con los usuarios existentes y sus propiedades principales', async () => {
            const first = await createUser();
            const second = await createUser({ role: USER_ROLES.DRIVER });

            const response = await request(app).get('/api/users');

            const body = expectSuccess(response, 200);
            expect(body.payload).to.be.an('array').with.lengthOf(2);
            body.payload.forEach((user) => {
                expect(user).to.include.all.keys('_id', 'firstName', 'lastName', 'email', 'role');
            });
            expect(body.payload.map((user) => user.email)).to.have.members([first.email, second.email]);
            expect(body.payload.map((user) => user.role)).to.have.members([USER_ROLES.CUSTOMER, USER_ROLES.DRIVER]);
        });
    });

    describe('POST /api/users', () => {
        it('responde 201 y crea el usuario', async () => {
            const newUser = buildUserData({ role: USER_ROLES.STORE });

            const response = await request(app).post('/api/users').send(newUser);

            const body = expectSuccess(response, 201);
            expect(body.payload).to.include.all.keys('_id', 'firstName', 'lastName', 'email', 'role', 'createdAt');
            expect(body.payload.firstName).to.equal(newUser.firstName);
            expect(body.payload.lastName).to.equal(newUser.lastName);
            expect(body.payload.email).to.equal(newUser.email);
            expect(body.payload.role).to.equal(USER_ROLES.STORE);

            // no alcanza con la respuesta: se verifica que quedó guardado
            const saved = await User.findById(body.payload._id);
            expect(saved).to.not.be.null;
            expect(saved.email).to.equal(newUser.email);
        });

        it('usa el rol customer si no se indica rol', async () => {
            const { role, ...withoutRole } = buildUserData();

            const response = await request(app).post('/api/users').send(withoutRole);

            const body = expectSuccess(response, 201);
            expect(body.payload.role).to.equal(USER_ROLES.CUSTOMER);
        });

        it('responde 400 VALIDATION_ERROR si faltan datos obligatorios', async () => {
            const response = await request(app).post('/api/users').send({ firstName: 'Solo nombre' });

            const body = expectApiError(response, 400, ErrorDictionary.VALIDATION_ERROR);
            // el detalle indica qué campos faltan
            expect(body.details.map((detail) => detail.field)).to.include.members(['lastName', 'email', 'password']);
            expect(findDetail(body, 'email')).to.have.property('message', 'El email es obligatorio');
            expect(await User.countDocuments()).to.equal(0);
        });

        it('responde 409 EMAIL_ALREADY_EXISTS si el email ya está registrado', async () => {
            const existing = await createUser();

            const response = await request(app)
                .post('/api/users')
                .send(buildUserData({ email: existing.email }));

            const body = expectApiError(response, 409, ErrorDictionary.EMAIL_ALREADY_EXISTS);
            expect(body.details).to.deep.equal([{ field: 'email', received: existing.email }]);
            expect(await User.countDocuments()).to.equal(1);
        });

        it('responde 403 ADMIN_CREATION_FORBIDDEN si se intenta crear un admin', async () => {
            const response = await request(app)
                .post('/api/users')
                .send(buildUserData({ role: USER_ROLES.ADMIN }));

            expectApiError(response, 403, ErrorDictionary.ADMIN_CREATION_FORBIDDEN);
            expect(await User.countDocuments()).to.equal(0);
        });

        it('responde 400 INVALID_USER_ROLE si el rol no existe', async () => {
            const response = await request(app)
                .post('/api/users')
                .send(buildUserData({ role: 'superman' }));

            const body = expectApiError(response, 400, ErrorDictionary.INVALID_USER_ROLE);
            expect(body.details).to.deep.equal([
                { field: 'role', received: 'superman', allowed: Object.values(USER_ROLES) }
            ]);
            expect(await User.countDocuments()).to.equal(0);
        });

        it('responde 400 INVALID_JSON si el body está mal formado', async () => {
            const response = await request(app)
                .post('/api/users')
                .set('Content-Type', 'application/json')
                .send('{"firstName": "Ana",');

            expectApiError(response, 400, ErrorDictionary.INVALID_JSON);
        });
    });

    describe('GET /api/users/:id', () => {
        it('responde 200 con el usuario si existe', async () => {
            const user = await createUser({ role: USER_ROLES.DRIVER });

            const response = await request(app).get(`/api/users/${user._id}`);

            const body = expectSuccess(response, 200);
            expect(body.payload).to.be.an('object');
            expect(body.payload._id).to.equal(user._id.toString());
            expect(body.payload.email).to.equal(user.email);
            expect(body.payload.firstName).to.equal(user.firstName);
            expect(body.payload.role).to.equal(USER_ROLES.DRIVER);
        });

        it('responde 404 USER_NOT_FOUND si el usuario no existe', async () => {
            const response = await request(app).get(`/api/users/${NON_EXISTENT_ID}`);

            const body = expectApiError(response, 404, ErrorDictionary.USER_NOT_FOUND);
            expect(body.details).to.deep.equal([]);
        });

        it('responde 400 INVALID_ID si el id no tiene formato de ObjectId', async () => {
            const response = await request(app).get(`/api/users/${MALFORMED_ID}`);

            const body = expectApiError(response, 400, ErrorDictionary.INVALID_ID);
            expect(body.details).to.deep.equal([{ field: '_id', received: MALFORMED_ID }]);
        });
    });

    describe('PUT /api/users/:id', () => {
        it('responde 200 con el usuario actualizado', async () => {
            const user = await createUser();

            const response = await request(app)
                .put(`/api/users/${user._id}`)
                .send({ firstName: 'Actualizado' });

            const body = expectSuccess(response, 200);
            expect(body.payload._id).to.equal(user._id.toString());
            expect(body.payload.firstName).to.equal('Actualizado');
            expect(body.payload.email).to.equal(user.email); // lo que no se envía no cambia

            const saved = await User.findById(user._id);
            expect(saved.firstName).to.equal('Actualizado');
        });

        it('responde 400 INVALID_USER_ROLE si el rol no existe', async () => {
            const user = await createUser();

            const response = await request(app)
                .put(`/api/users/${user._id}`)
                .send({ role: 'superheroe' });

            expectApiError(response, 400, ErrorDictionary.INVALID_USER_ROLE);

            const saved = await User.findById(user._id);
            expect(saved.role).to.equal(USER_ROLES.CUSTOMER); // no se modificó
        });

        it('responde 404 USER_NOT_FOUND si el usuario no existe', async () => {
            const response = await request(app)
                .put(`/api/users/${NON_EXISTENT_ID}`)
                .send({ firstName: 'Nadie' });

            expectApiError(response, 404, ErrorDictionary.USER_NOT_FOUND);
        });

        it('responde 400 INVALID_ID si el id no tiene formato de ObjectId', async () => {
            const response = await request(app)
                .put(`/api/users/${MALFORMED_ID}`)
                .send({ firstName: 'Nadie' });

            expectApiError(response, 400, ErrorDictionary.INVALID_ID);
        });

        it('responde 409 DUPLICATE_KEY si el email ya lo usa otro usuario', async () => {
            const first = await createUser();
            const second = await createUser();

            const response = await request(app)
                .put(`/api/users/${second._id}`)
                .send({ email: first.email });

            const body = expectApiError(response, 409, ErrorDictionary.DUPLICATE_KEY);
            expect(body.details).to.deep.equal([{ field: 'email', received: first.email }]);
        });

        it('responde 400 INVALID_JSON si el body está mal formado', async () => {
            const user = await createUser();

            const response = await request(app)
                .put(`/api/users/${user._id}`)
                .set('Content-Type', 'application/json')
                .send('{"firstName":');

            expectApiError(response, 400, ErrorDictionary.INVALID_JSON);
        });
    });

    describe('DELETE /api/users/:id', () => {
        it('responde 200 y elimina el usuario', async () => {
            const user = await createUser();

            const response = await request(app).delete(`/api/users/${user._id}`);

            const body = expectSuccess(response, 200);
            expect(body.message).to.equal('Usuario eliminado');
            expect(await User.findById(user._id)).to.be.null;
        });

        it('responde 404 USER_NOT_FOUND si el usuario no existe', async () => {
            const response = await request(app).delete(`/api/users/${NON_EXISTENT_ID}`);

            expectApiError(response, 404, ErrorDictionary.USER_NOT_FOUND);
        });

        it('responde 400 INVALID_ID si el id no tiene formato de ObjectId', async () => {
            const response = await request(app).delete(`/api/users/${MALFORMED_ID}`);

            expectApiError(response, 400, ErrorDictionary.INVALID_ID);
        });
    });
});
