import mongoose from 'mongoose';
import config from '../src/config/config.js';
import { NODE_ENVS } from '../src/constants/constants.js';
import User from '../src/models/user.model.js';
import Order from '../src/models/order.model.js';
import Delivery from '../src/models/delivery.model.js';

// Hooks globales de Mocha (se cargan desde .mocharc.json, antes de cualquier test).
//
// - beforeAll: verifica que estamos en la base de TEST y se conecta.
// - afterAll:  borra la base de test completa y se desconecta.
//
// Cada archivo de tests limpia además las colecciones que usa en su propio beforeEach
// (ver tests/helpers/index.js -> clearDatabase), así ningún test depende de otro.

// "mongodb://host:27017/shipnow-test?opciones" -> "shipnow-test"
const databaseNameFrom = (uri = '') => {
    const match = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/);
    return match ? match[1] : '';
};

const looksLikeTestDatabase = (name) => /test/i.test(name);

export const mochaHooks = {
    async beforeAll() {
        // Freno de mano: la suite borra datos, así que nunca puede correr contra la base de desarrollo.
        if (config.nodeEnv !== NODE_ENVS.TEST) {
            throw new Error(
                `Tests abortados: NODE_ENV="${config.nodeEnv}". Corré la suite con "npm test" (define NODE_ENV=test).`
            );
        }

        if (!config.mongoUri) {
            throw new Error(
                'Tests abortados: falta MONGODB_URI. Copiá .env.test.example a .env.test y completalo.'
            );
        }

        const databaseName = databaseNameFrom(config.mongoUri);
        if (!looksLikeTestDatabase(databaseName)) {
            throw new Error(
                `Tests abortados: la base "${databaseName || '(sin nombre)'}" no parece de test. ` +
                'El nombre de la base en MONGODB_URI (.env.test) tiene que contener "test", por ejemplo shipnow-test.'
            );
        }

        await mongoose.connect(config.mongoUri);

        await Promise.all([User.init(), Order.init(), Delivery.init()]);
    },

    async afterAll() {
        // afterAll corre aunque beforeAll haya fallado: si nunca hubo conexión, no hay nada que borrar.
        if (mongoose.connection.readyState !== 1) {
            return;
        }

        // Segunda verificación, con el nombre real de la base a la que quedamos conectados.
        if (looksLikeTestDatabase(mongoose.connection.name)) {
            await mongoose.connection.dropDatabase();
        }
        await mongoose.disconnect();
    }
};
