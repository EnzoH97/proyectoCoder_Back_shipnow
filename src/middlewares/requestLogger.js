import logger from '../utils/logger.js';

// Registra cada petición HTTP (nivel http): método, ruta, status y duración.
// No guarda el cuerpo de la petición, para no escribir contraseñas en los archivos.
const requestLogger = (req, res, next) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
    });

    next();
};

export default requestLogger;
