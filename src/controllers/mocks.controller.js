import mocksService from '../services/mocks.service.js';

class MocksController {

    getUsers = (req, res, next) => {
        try {
            res.json({ status: 'success', payload: mocksService.getUsers(req.query.qty) });
        } catch (error) {
            next(error);
        }
    };

    getDrivers = (req, res, next) => {
        try {
            res.json({ status: 'success', payload: mocksService.getDrivers(req.query.qty) });
        } catch (error) {
            next(error);
        }
    };

    getOrders = (req, res, next) => {
        try {
            res.json({ status: 'success', payload: mocksService.getOrders(req.query.qty) });
        } catch (error) {
            next(error);
        }
    };

    getDeliveries = (req, res, next) => {
        try {
            res.json({ status: 'success', payload: mocksService.getDeliveries(req.query.qty) });
        } catch (error) {
            next(error);
        }
    };

    getDataset = (req, res, next) => {
        try {
            res.json({ status: 'success', payload: mocksService.getDataset(req.query) });
        } catch (error) {
            next(error);
        }
    };

    seed = async (req, res, next) => {
        try {
            const { collection, qty } = req.query;
            const result = await mocksService.seed(collection, qty);
            res.status(201).json({ status: 'success', ...result });
        } catch (error) {
            next(error);
        }
    };
}

export default new MocksController();
