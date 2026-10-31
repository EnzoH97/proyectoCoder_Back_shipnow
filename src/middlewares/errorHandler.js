import AppError, { ErrorDictionary } from '../utils/errors.js';
import logger from '../utils/logger.js';

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

const logError = (req, originalError, finalError) => {
    const message = `${req.method} ${req.originalUrl} -> ${finalError.statusCode} ${finalError.code}: ${finalError.message}`;
    const meta = {};

    if (finalError.details.length > 0) {
        meta.details = finalError.details;
    }

    if (originalError !== finalError && originalError?.message) {
        meta.cause = originalError.message;
    }

    if (finalError.statusCode < 500) {
        logger.warning(message, meta);
        return;
    }

    meta.stack = originalError?.stack;
    if (finalError.code === ErrorDictionary.CONFIG_ERROR.code) {
        logger.fatal(message, meta);
    } else {
        logger.error(message, meta);
    }
};

const errorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    const appError = err instanceof AppError ? err : translateError(err);
    const finalError = appError || new AppError(ErrorDictionary.INTERNAL_SERVER_ERROR);

    logError(req, err, finalError);

    res.status(finalError.statusCode).json({
        status: 'error',
        code: finalError.code,
        message: finalError.message,
        details: finalError.details
    });
};

export default errorHandler;
