import express from 'express';
import cors from 'cors';
import apiRouter from './routes/index.js';
import routeNotFound from './middlewares/routeNotFound.js'
import errorHandler from './middlewares/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRouter);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


//primero rutas no encontradas, después el manejador global de errores
app.use(routeNotFound);
app.use(errorHandler);

export default app;
