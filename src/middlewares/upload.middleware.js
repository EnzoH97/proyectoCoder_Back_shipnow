import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import AppError, { ErrorDictionary } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { folderPath } from '../utils/fileStorage.js';
import {
    ALLOWED_MIME_TYPES,
    UPLOAD_FIELDS,
    UPLOAD_FOLDERS,
    UPLOAD_LIMITS
} from '../constants/constants.js';


// ---------- dónde se guarda y cómo se nombra ----------

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const tmpFolder = folderPath(UPLOAD_FOLDERS.TMP);
        // si la carpeta no existe se crea, así no rompe el servidor
        fs.mkdir(tmpFolder, { recursive: true }, (error) => cb(error, tmpFolder));
    },
    filename: (req, file, cb) => {
        // nombre único; la extensión sale del tipo ya validado, no del nombre que mandó el cliente
        const extension = ALLOWED_MIME_TYPES[file.mimetype];
        cb(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
    }
});

// ---------- qué tipos se aceptan ----------

const fileFilter = (req, file, cb) => {
    if (Object.hasOwn(ALLOWED_MIME_TYPES, file.mimetype)) {
        return cb(null, true);
    }

    logger.warning(`Intento de subir un archivo con tipo no permitido: ${file.mimetype}`, {
        originalName: file.originalname,
        field: file.fieldname,
        route: `${req.method} ${req.originalUrl}`
    });

    cb(new AppError(ErrorDictionary.INVALID_FILE_TYPE, [
        { field: file.fieldname, received: file.mimetype, allowed: Object.keys(ALLOWED_MIME_TYPES) }
    ]));
};

// ---------- tamaño máximo ----------

const limits = { fileSize: UPLOAD_LIMITS.MAX_FILE_SIZE };

const upload = multer({ storage, fileFilter, limits });

// ---------- manejo de errores de carga ----------

function translateUploadError(error, fieldName, req) {
    if (error instanceof AppError) {
        return error;
    }

    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            logger.warning('Archivo rechazado por superar el tamaño máximo', {
                maxSizeBytes: UPLOAD_LIMITS.MAX_FILE_SIZE,
                route: `${req.method} ${req.originalUrl}`
            });
            return new AppError(ErrorDictionary.INVALID_FILE_SIZE, [
                {
                    field: fieldName,
                    maxSizeBytes: UPLOAD_LIMITS.MAX_FILE_SIZE,
                    maxSizeMB: UPLOAD_LIMITS.MAX_FILE_SIZE / (1024 * 1024)
                }
            ]);
        }

        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            logger.warning(`Archivo enviado en un campo inesperado: "${error.field}"`, {
                expectedField: fieldName,
                route: `${req.method} ${req.originalUrl}`
            });
            return new AppError(ErrorDictionary.UNEXPECTED_FILE_FIELD, [
                { field: error.field, expected: fieldName }
            ]);
        }

        return new AppError(ErrorDictionary.UPLOAD_ERROR, [{ field: error.field ?? fieldName, reason: error.code }]);
    }

    if (typeof error.code === 'string' && /^E[A-Z]+$/.test(error.code)) {
        logger.error('No se pudo escribir el archivo subido', { cause: error.message });
        return new AppError(ErrorDictionary.FILE_SAVE_ERROR);
    }

    return new AppError(ErrorDictionary.UPLOAD_ERROR, [{ reason: error.message }]);
}

const uploadSingleFile = (fieldName) => {
    const receiveFile = upload.single(fieldName);

    return (req, res, next) => {
        receiveFile(req, res, (error) => {
            if (error) {
                return next(translateUploadError(error, fieldName, req));
            }
            next();
        });
    };
};

// ---------- middlewares que usan los routers ----------

// POST /api/users/:id/documents  (campo "document")
export const uploadUserDocument = uploadSingleFile(UPLOAD_FIELDS.USER_DOCUMENT);

// POST /api/deliveries/:id/proofs  (campo "proof")
export const uploadDeliveryProof = uploadSingleFile(UPLOAD_FIELDS.DELIVERY_PROOF);
