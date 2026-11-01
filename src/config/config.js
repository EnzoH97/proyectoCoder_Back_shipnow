import dotenv from 'dotenv';
import { NODE_ENVS, LOG_LEVELS } from "../constants/constants.js";

dotenv.config();

const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];

// Se llama al arrancar el servidor (server.js). Si falta algo crítico, el servidor no inicia
// y el motivo queda registrado como fatal en el logger.
export function validateConfig() {
    const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);

    if (missing.length > 0) {
        throw new Error(
            `Falta configurar la variable de entorno: ${missing.join(', ')}\n` +
            `Revisá el archivo .env (copiado desde .env.example)`
        );
    }
}

const nodeEnv = process.env.NODE_ENV || NODE_ENVS.DEVELOPMENT;

const config = {
    port: parseInt(process.env.PORT, 10) || 8080,
    mongoUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
    nodeEnv,
    // sin LOG_LEVEL: desarrollo registra todo (debug) y producción desde info
    logLevel: process.env.LOG_LEVEL || (nodeEnv === NODE_ENVS.PRODUCTION ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG)
};

export default config;
