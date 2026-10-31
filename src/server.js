import mongoose from 'mongoose';
import app from './app.js';
import config,  { validateConfig } from './config/config.js';
import logger, { flushAndExit } from './utils/logger.js';

process.on('unhandledRejection', (reason) => {
    logger.fatal('Promesa rechazada sin manejar', { cause: reason?.message ?? String(reason), stack: reason?.stack });
    flushAndExit(1);
});

process.on('uncaughtException', (error) => {
    logger.fatal('Excepción no capturada', { cause: error.message, stack: error.stack });
    flushAndExit(1);
});

// Estado de la conexión con MongoDB una vez establecida
mongoose.connection.on('disconnected', () => logger.warning('MongoDB desconectado'));
mongoose.connection.on('reconnected', () => logger.info('MongoDB reconectado'));
mongoose.connection.on('error', (error) => logger.error('Error en la conexión con MongoDB', { cause: error.message }));

async function startServer() {
    try {
        validateConfig();
    } catch (error) {
        logger.fatal(`Configuración inválida: ${error.message.split('\n')[0]}`);
        return flushAndExit(1);
    }

    try {
        await mongoose.connect(config.mongoUri);
        logger.info(`Conexión a MongoDB establecida (${config.nodeEnv})`);
    } catch (error) {
        logger.fatal('Falló la conexión inicial a MongoDB', { cause: error.message });
        return flushAndExit(1);
    }

    app.listen(config.port, () => {
        logger.info(`Servidor ShipNow escuchando en el puerto ${config.port} (entorno: ${config.nodeEnv}, nivel de log: ${logger.level})`);
    });
}

startServer();
