import express from 'express';
import cors from 'cors';
import apiRouter from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRouter);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// rutas no matcheadas
app.use((req, res) => {
    res.status(404).json({ status: 'error', message: 'Ruta no encontrada' });
});

// errores pasados con next(err)
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Error interno del servidor';
    
    res.status(statusCode).json({
        status: 'error',
        message
    });
});

export default app;
