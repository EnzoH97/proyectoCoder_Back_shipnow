import { expect } from 'chai';
import request from 'supertest';
import app from '../src/app.js';
import config from '../src/config/config.js';
import User from '../src/models/user.model.js';
import Delivery from '../src/models/delivery.model.js';
import { ErrorDictionary } from '../src/utils/errors.js';
import {
    DOCUMENT_TYPES,
    USER_DOCUMENT_TYPES,
    ALLOWED_MIME_TYPES,
    UPLOAD_LIMITS
} from '../src/constants/constants.js';
import {
    clearDatabase,
    createUser,
    createDriver,
    createOrder,
    createDelivery,
    expectSuccess,
    expectApiError,
    NON_EXISTENT_ID,
    MALFORMED_ID,
    FILE_METADATA_KEYS,
    PDF_FILE,
    PNG_FILE,
    TEXT_FILE,
    oversizedFile,
    attachOptions,
    removeUploads,
    listStoredFiles,
    fileExists,
    readFile
} from './helpers/index.js';

// Los archivos se crean en memoria y se guardan en uploads/test (nunca en la carpeta de desarrollo).
// Cada test arranca sin archivos ni datos en la base, y al terminar el grupo se borra uploads/test.

const MAX_SIZE_DETAILS = [{
    field: 'document',
    maxSizeBytes: UPLOAD_LIMITS.MAX_FILE_SIZE,
    maxSizeMB: UPLOAD_LIMITS.MAX_FILE_SIZE / (1024 * 1024)
}];

describe('Carga de archivos (Multer)', () => {
    beforeEach(async () => {
        await clearDatabase();
        await removeUploads();
    });

    after(removeUploads);

    // ---------- documentos de usuario ----------

    describe('POST /api/users/:id/documents', () => {
        let customer;
        let driver;

        beforeEach(async () => {
            customer = await createUser();
            driver = await createDriver();
        });

        // envía multipart/form-data: primero los campos de texto y después el archivo
        const uploadDocument = (userId, { file = PDF_FILE, fields = {}, fieldName = 'document' } = {}) => {
            const req = request(app).post(`/api/users/${userId}/documents`);
            Object.entries(fields).forEach(([name, value]) => req.field(name, value));
            return req.attach(fieldName, file.content, attachOptions(file));
        };

        describe('casos exitosos', () => {
            it('responde 201, guarda el archivo en uploads/documents y registra sus metadatos', async () => {
                const response = await uploadDocument(customer._id, { fields: { type: DOCUMENT_TYPES.USER_DOCUMENT } });

                const body = expectSuccess(response, 201);
                expect(body.message).to.equal('Documento cargado correctamente');
                expect(body.payload._id).to.equal(customer._id.toString());
                expect(body.payload.documents).to.be.an('array').with.lengthOf(1);

                // en la base van solo los metadatos (nunca el contenido del archivo)
                const [document] = body.payload.documents;
                expect(document).to.have.all.keys(...FILE_METADATA_KEYS);
                expect(document.originalName).to.equal('dni.pdf');
                expect(document.fileName).to.match(/^\d+-[0-9a-f-]{36}\.pdf$/); // nombre generado, distinto del original
                expect(document.path).to.equal(`${config.uploadsDir}/documents/${document.fileName}`);
                expect(document.mimeType).to.equal('application/pdf');
                expect(document.size).to.equal(PDF_FILE.content.length);
                expect(document.type).to.equal(DOCUMENT_TYPES.USER_DOCUMENT);
                expect(new Date(document.uploadedAt).toISOString()).to.equal(document.uploadedAt);

                // el archivo quedó en el disco con el contenido que se subió
                expect(await fileExists(document.path)).to.be.true;
                expect((await readFile(document.path)).equals(PDF_FILE.content)).to.be.true;

                // y los metadatos quedaron guardados en el usuario
                const saved = await User.findById(customer._id);
                expect(saved.documents).to.have.lengthOf(1);
                expect(saved.documents[0].fileName).to.equal(document.fileName);
            });

            it('usa el tipo user_document si no se envía el campo type', async () => {
                const response = await uploadDocument(customer._id);

                const body = expectSuccess(response, 201);
                expect(body.payload.documents[0].type).to.equal(DOCUMENT_TYPES.USER_DOCUMENT);
            });

            it('guarda la licencia de conducir de un repartidor en uploads/licenses', async () => {
                const response = await uploadDocument(driver._id, { fields: { type: DOCUMENT_TYPES.DRIVER_LICENSE } });

                const body = expectSuccess(response, 201);
                const [document] = body.payload.documents;
                expect(document.type).to.equal(DOCUMENT_TYPES.DRIVER_LICENSE);
                expect(document.path).to.equal(`${config.uploadsDir}/licenses/${document.fileName}`);
                expect(await fileExists(document.path)).to.be.true;
            });

            it('acepta imágenes y acumula los documentos del usuario', async () => {
                await uploadDocument(customer._id);
                const response = await uploadDocument(customer._id, { file: PNG_FILE });

                const body = expectSuccess(response, 201);
                expect(body.payload.documents).to.have.lengthOf(2);
                expect(body.payload.documents[1].mimeType).to.equal('image/png');
                expect(body.payload.documents[1].fileName).to.match(/\.png$/);
                expect(await listStoredFiles()).to.have.lengthOf(2);
            });

            it('al eliminar el usuario se eliminan también sus archivos del disco', async () => {
                const uploaded = await uploadDocument(customer._id);
                const [document] = expectSuccess(uploaded, 201).payload.documents;

                const response = await request(app).delete(`/api/users/${customer._id}`);

                expectSuccess(response, 200);
                expect(await fileExists(document.path)).to.be.false;
            });
        });

        describe('casos de error', () => {
            const expectNoFilesLeft = async () => {
                expect(await listStoredFiles(), 'archivos que quedaron en el disco').to.be.empty;
            };

            it('responde 400 FILE_REQUIRED si no se envía ningún archivo', async () => {
                const response = await request(app)
                    .post(`/api/users/${customer._id}/documents`)
                    .field('type', DOCUMENT_TYPES.USER_DOCUMENT);

                const body = expectApiError(response, 400, ErrorDictionary.FILE_REQUIRED);
                expect(body.details).to.deep.equal([{ field: 'document' }]);
                expect((await User.findById(customer._id)).documents).to.be.empty;
            });

            it('responde 400 FILE_REQUIRED si el request ni siquiera es multipart', async () => {
                const response = await request(app)
                    .post(`/api/users/${customer._id}/documents`)
                    .send({ type: DOCUMENT_TYPES.USER_DOCUMENT });

                expectApiError(response, 400, ErrorDictionary.FILE_REQUIRED);
            });

            it('responde 400 INVALID_DOCUMENT_TYPE si el tipo de documento no existe', async () => {
                const response = await uploadDocument(customer._id, { fields: { type: 'pasaporte' } });

                const body = expectApiError(response, 400, ErrorDictionary.INVALID_DOCUMENT_TYPE);
                expect(body.details).to.deep.equal([
                    { field: 'type', received: 'pasaporte', allowed: USER_DOCUMENT_TYPES }
                ]);
                expect((await User.findById(customer._id)).documents).to.be.empty;
                await expectNoFilesLeft();
            });

            it('responde 400 INVALID_DOCUMENT_TYPE si el tipo es de otra entidad (delivery_proof)', async () => {
                const response = await uploadDocument(customer._id, { fields: { type: DOCUMENT_TYPES.DELIVERY_PROOF } });

                expectApiError(response, 400, ErrorDictionary.INVALID_DOCUMENT_TYPE);
                await expectNoFilesLeft();
            });

            it('responde 400 INVALID_FILE_TYPE si el archivo no es PDF ni imagen', async () => {
                const response = await uploadDocument(customer._id, { file: TEXT_FILE });

                const body = expectApiError(response, 400, ErrorDictionary.INVALID_FILE_TYPE);
                expect(body.details).to.deep.equal([
                    { field: 'document', received: 'text/plain', allowed: Object.keys(ALLOWED_MIME_TYPES) }
                ]);
                expect((await User.findById(customer._id)).documents).to.be.empty;
                await expectNoFilesLeft();
            });

            it('responde 413 INVALID_FILE_SIZE si el archivo supera el tamaño máximo', async () => {
                const response = await uploadDocument(customer._id, { file: oversizedFile() });

                const body = expectApiError(response, 413, ErrorDictionary.INVALID_FILE_SIZE);
                expect(body.details).to.deep.equal(MAX_SIZE_DETAILS);
                expect((await User.findById(customer._id)).documents).to.be.empty;
                await expectNoFilesLeft();
            });

            it('responde 400 UNEXPECTED_FILE_FIELD si el archivo se envía en otro campo', async () => {
                const response = await uploadDocument(customer._id, { fieldName: 'archivo' });

                const body = expectApiError(response, 400, ErrorDictionary.UNEXPECTED_FILE_FIELD);
                expect(body.details).to.deep.equal([{ field: 'archivo', expected: 'document' }]);
                await expectNoFilesLeft();
            });

            it('responde 400 USER_NOT_DRIVER si un usuario que no es repartidor carga una licencia', async () => {
                const response = await uploadDocument(customer._id, { fields: { type: DOCUMENT_TYPES.DRIVER_LICENSE } });

                expectApiError(response, 400, ErrorDictionary.USER_NOT_DRIVER);
                expect((await User.findById(customer._id)).documents).to.be.empty;
                await expectNoFilesLeft();
            });

            it('responde 404 USER_NOT_FOUND si el usuario no existe y no deja el archivo en el disco', async () => {
                const response = await uploadDocument(NON_EXISTENT_ID);

                expectApiError(response, 404, ErrorDictionary.USER_NOT_FOUND);
                await expectNoFilesLeft();
            });

            it('responde 400 INVALID_ID si el id del usuario no tiene formato válido', async () => {
                const response = await uploadDocument(MALFORMED_ID);

                const body = expectApiError(response, 400, ErrorDictionary.INVALID_ID);
                expect(body.details).to.deep.equal([{ field: '_id', received: MALFORMED_ID }]);
                await expectNoFilesLeft();
            });
        });
    });

    // ---------- comprobantes de entrega ----------

    describe('POST /api/deliveries/:id/proofs', () => {
        let delivery;

        beforeEach(async () => {
            const customer = await createUser();
            const order = await createOrder(customer._id);
            delivery = await createDelivery(order._id);
        });

        const uploadProof = (deliveryId, { file = PDF_FILE, fieldName = 'proof' } = {}) => (
            request(app)
                .post(`/api/deliveries/${deliveryId}/proofs`)
                .attach(fieldName, file.content, attachOptions(file))
        );

        describe('casos exitosos', () => {
            it('responde 201, guarda el archivo en uploads/proofs y devuelve la entrega actualizada', async () => {
                const response = await uploadProof(delivery._id);

                const body = expectSuccess(response, 201);
                expect(body.message).to.equal('Comprobante cargado correctamente');
                expect(body.payload._id).to.equal(delivery._id.toString());
                expect(body.payload.order).to.be.an('object'); // la entrega viene con el pedido completado
                expect(body.payload.proofs).to.be.an('array').with.lengthOf(1);

                const [proof] = body.payload.proofs;
                expect(proof).to.have.all.keys(...FILE_METADATA_KEYS);
                expect(proof.originalName).to.equal('dni.pdf');
                expect(proof.fileName).to.match(/^\d+-[0-9a-f-]{36}\.pdf$/);
                expect(proof.path).to.equal(`${config.uploadsDir}/proofs/${proof.fileName}`);
                expect(proof.mimeType).to.equal('application/pdf');
                expect(proof.size).to.equal(PDF_FILE.content.length);
                expect(proof.type).to.equal(DOCUMENT_TYPES.DELIVERY_PROOF);

                expect(await fileExists(proof.path)).to.be.true;

                // el comprobante quedó asociado a la entrega en la base
                const saved = await Delivery.findById(delivery._id);
                expect(saved.proofs).to.have.lengthOf(1);
                expect(saved.proofs[0].fileName).to.equal(proof.fileName);
            });

            it('acumula los comprobantes de la entrega', async () => {
                await uploadProof(delivery._id);
                const response = await uploadProof(delivery._id, { file: PNG_FILE });

                const body = expectSuccess(response, 201);
                expect(body.payload.proofs).to.have.lengthOf(2);
                expect(body.payload.proofs[1].mimeType).to.equal('image/png');
                expect(await listStoredFiles()).to.have.lengthOf(2);
            });

            it('al eliminar la entrega se eliminan también sus comprobantes del disco', async () => {
                const uploaded = await uploadProof(delivery._id);
                const [proof] = expectSuccess(uploaded, 201).payload.proofs;

                const response = await request(app).delete(`/api/deliveries/${delivery._id}`);

                expectSuccess(response, 200);
                expect(await fileExists(proof.path)).to.be.false;
            });
        });

        describe('casos de error', () => {
            const expectNoFilesLeft = async () => {
                expect(await listStoredFiles(), 'archivos que quedaron en el disco').to.be.empty;
            };

            it('responde 400 FILE_REQUIRED si no se envía ningún archivo', async () => {
                const response = await request(app)
                    .post(`/api/deliveries/${delivery._id}/proofs`)
                    .field('nota', 'sin archivo');

                const body = expectApiError(response, 400, ErrorDictionary.FILE_REQUIRED);
                expect(body.details).to.deep.equal([{ field: 'proof' }]);
                expect((await Delivery.findById(delivery._id)).proofs).to.be.empty;
            });

            it('responde 400 INVALID_FILE_TYPE si el comprobante no es PDF ni imagen', async () => {
                const response = await uploadProof(delivery._id, { file: TEXT_FILE });

                const body = expectApiError(response, 400, ErrorDictionary.INVALID_FILE_TYPE);
                expect(body.details).to.deep.equal([
                    { field: 'proof', received: 'text/plain', allowed: Object.keys(ALLOWED_MIME_TYPES) }
                ]);
                expect((await Delivery.findById(delivery._id)).proofs).to.be.empty;
                await expectNoFilesLeft();
            });

            it('responde 413 INVALID_FILE_SIZE si el comprobante supera el tamaño máximo', async () => {
                const response = await uploadProof(delivery._id, { file: oversizedFile() });

                const body = expectApiError(response, 413, ErrorDictionary.INVALID_FILE_SIZE);
                expect(body.details).to.deep.equal([{ ...MAX_SIZE_DETAILS[0], field: 'proof' }]);
                await expectNoFilesLeft();
            });

            it('responde 400 UNEXPECTED_FILE_FIELD si el archivo se envía en otro campo', async () => {
                const response = await uploadProof(delivery._id, { fieldName: 'document' });

                const body = expectApiError(response, 400, ErrorDictionary.UNEXPECTED_FILE_FIELD);
                expect(body.details).to.deep.equal([{ field: 'document', expected: 'proof' }]);
                await expectNoFilesLeft();
            });

            it('responde 404 DELIVERY_NOT_FOUND si la entrega no existe y no deja el archivo en el disco', async () => {
                const response = await uploadProof(NON_EXISTENT_ID);

                expectApiError(response, 404, ErrorDictionary.DELIVERY_NOT_FOUND);
                await expectNoFilesLeft();
            });

            it('responde 400 INVALID_ID si el id de la entrega no tiene formato válido', async () => {
                const response = await uploadProof(MALFORMED_ID);

                const body = expectApiError(response, 400, ErrorDictionary.INVALID_ID);
                expect(body.details).to.deep.equal([{ field: '_id', received: MALFORMED_ID }]);
                await expectNoFilesLeft();
            });
        });
    });
});
