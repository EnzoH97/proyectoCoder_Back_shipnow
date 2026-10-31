import loggerService from '../services/logger.service.js';

class LoggerController {

    test = (req, res, next) => {
        try {
            res.json({ status: 'success', payload: loggerService.testAllLevels() });
        } catch (error) {
            next(error);
        }
    };
}

export default new LoggerController();
