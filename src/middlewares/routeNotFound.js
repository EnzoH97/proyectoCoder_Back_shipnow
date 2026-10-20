import AppError, { ErrorDictionary } from '../utils/errors.js';

// Se ejecuta cuando ninguna ruta coincidió; deriva al errorHandler.
const routeNotFound = (req, res, next) => {
    next(new AppError(ErrorDictionary.ROUTE_NOT_FOUND, [{ method: req.method, path: req.originalUrl }]));
};

export default routeNotFound;
