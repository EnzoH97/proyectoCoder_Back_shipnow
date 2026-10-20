import AppError, { ErrorDictionary } from '../utils/errors.js';

// Convierte errores "de librería" (Mongoose, body-parser, MongoDB) en AppError del diccionario.
// Devuelve null si el error no se reconoce (se tratará como 500).
const translateError = (err) => {
    if (err.type === 'entity.parse.failed') {
        return new AppError(ErrorDictionary.INVALID_JSON);
    }

    if (err.name === 'CastError') {
        return new AppError(ErrorDictionary.INVALID_ID, [{ field: err.path, received: String(err.value) }]);
    }

    if (err.name === 'ValidationError' && err.errors) {
        const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
        return new AppError(ErrorDictionary.VALIDATION_ERROR, details);
    }

    if (err.code === 11000) {
        const details = Object.entries(err.keyValue || {}).map(([field, value]) => ({ field, received: String(value) }));
        return new AppError(ErrorDictionary.DUPLICATE_KEY, details);
    }

    return null;
};

// Único punto de la API que responde errores al cliente.
// Formato: { status: 'error', code, message, details }
const errorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    const appError = err instanceof AppError ? err : translateError(err);
    const finalError = appError || new AppError(ErrorDictionary.INTERNAL_SERVER_ERROR);

    // los errores del servidor se registran en consola; el cliente nunca ve el detalle interno
    if (finalError.statusCode >= 500) {
        console.error(`[${req.method} ${req.originalUrl}]`, err);
    }

    res.status(finalError.statusCode).json({
        status: 'error',
        code: finalError.code,
        message: finalError.message,
        details: finalError.details
    });
};

export default errorHandler;
