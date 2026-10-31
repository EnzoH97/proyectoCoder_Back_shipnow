import winston from "winston";
import DailyRotateFile from 'winston-daily-rotate-file';
import config from '../config/config.js';
import { NODE_ENVS, LOG_LEVELS, LOG_LEVEL_PRIORITIES } from '../constants/constants.js';

// Logger centralizado: todo el proyecto importa este mismo módulo.
//
// level        -> nivel mínimo que se registra (todo lo menos grave se descarta)
// format       -> cómo se escribe cada línea:  fecha [nivel] mensaje
// transports   -> adónde se envía: consola y archivos con rotación diaria

const LOGS_DIR = 'logs';
const MAX_FILE_SIZE = '10m';   // rota también si un archivo supera este tamaño
const MAX_FILE_AGE = '14d';    // se conservan 14 días de historial

const isProduction = config.nodeEnv === NODE_ENVS.PRODUCTION;
const isValidLevel = Object.values(LOG_LEVELS).includes(config.logLevel);
const activeLevel = isValidLevel ? config.logLevel : (isProduction ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG);

winston.addColors({
    [LOG_LEVELS.FATAL]: 'bold magenta',
    [LOG_LEVELS.ERROR]: 'red',
    [LOG_LEVELS.WARNING]: 'yellow',
    [LOG_LEVELS.INFO]: 'green',
    [LOG_LEVELS.HTTP]: 'cyan',
    [LOG_LEVELS.DEBUG]: 'blue'
});

const LEVEL = Symbol.for('level'); // nivel original, sin colores

// 2026-08-01 10:12:03 [info]    mensaje {"dato":"extra"}
const lineFormat = winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...meta } = info;
    const padding = ' '.repeat(Math.max(1, 10 - (info[LEVEL].length + 2)));

    let line = `${timestamp} [${level}]${padding}${message}`;
    if (Object.keys(meta).length > 0) {
        line += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
        line += `\n${stack}`;
    }
    return line;
});

const timestamp = winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' });

// consola: con colores en desarrollo, sin colores en producción
const consoleFormat = isProduction
    ? winston.format.combine(timestamp, lineFormat)
    : winston.format.combine(timestamp, winston.format.colorize(), lineFormat);

// archivos: siempre texto plano
const fileFormat = winston.format.combine(timestamp, lineFormat);

const rotatingFile = (name, level) => new DailyRotateFile({
    dirname: LOGS_DIR,
    filename: `${name}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILE_AGE,
    zippedArchive: true,
    level,
    format: fileFormat
});

const logger = winston.createLogger({
    levels: LOG_LEVEL_PRIORITIES,
    level: activeLevel,
    transports: [
        new winston.transports.Console({ format: consoleFormat }),

        // error-AAAA-MM-DD.log: solo "error" y "fatal"
        rotatingFile('error', LOG_LEVELS.ERROR),

        // combined-AAAA-MM-DD.log: todo lo que habilita el nivel activo
        rotatingFile('combined')
    ]
});

if (!isValidLevel) {
    logger.warning(`LOG_LEVEL="${config.logLevel}" no es válido. Se usa "${activeLevel}"`, {
        validos: Object.values(LOG_LEVELS)
    });
}

// Cierra el logger esperando a que se escriban los archivos y recién después termina el proceso.
// Se usa en fallas fatales, para no perder el último mensaje con un process.exit() directo.
export const flushAndExit = (code = 1) => {
    let exited = false;
    const exit = () => {
        if (!exited) {
            exited = true;
            process.exit(code);
        }
    };

    logger.once('finish', () => setTimeout(exit, 200));
    logger.end();
    setTimeout(exit, 2000); // por si algún transporte nunca avisa que terminó
};

export default logger;