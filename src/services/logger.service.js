import logger from '../utils/logger.js';
import { LOG_LEVELS, LOG_LEVEL_PRIORITIES } from '../constants/constants.js';

// De menos a más grave
const TEST_ORDER = [
    LOG_LEVELS.DEBUG,
    LOG_LEVELS.HTTP,
    LOG_LEVELS.INFO,
    LOG_LEVELS.WARNING,
    LOG_LEVELS.ERROR,
    LOG_LEVELS.FATAL
];

class LoggerService {

    // Genera un mensaje por cada nivel. Según el nivel activo del entorno, algunos
    // se descartan (por ejemplo debug y http en producción).
    testAllLevels() {
        const activeLevel = logger.level;

        const levels = TEST_ORDER.map((level) => {
            const message = `[logger-test] Mensaje de prueba de nivel ${level}`;
            logger[level](message);

            return {
                level,
                message,
                // mismo criterio que usa el logger para decidir si lo registra
                registered: LOG_LEVEL_PRIORITIES[level] <= LOG_LEVEL_PRIORITIES[activeLevel]
            };
        });

        return { activeLevel, levels };
    }
}

export default new LoggerService();
