import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import config from '../config/config.js';
import AppError, { ErrorDictionary } from './errors.js';
import logger from './logger.js';
import { UPLOAD_FOLDERS } from '../constants/constants.js';

const toPosix = (filePath) => filePath.replace(/\\/g, '/');
export const folderPath = (subfolder) => toPosix(path.join(config.uploadsDir, subfolder));

export function ensureUploadFolders() {
    Object.values(UPLOAD_FOLDERS).forEach((subfolder) => {
        fsSync.mkdirSync(folderPath(subfolder), { recursive: true });
    });
}

export async function storeUploadedFile(file, documentType) {
    const targetFolder = folderPath(UPLOAD_FOLDERS[documentType]);
    const targetPath = `${targetFolder}/${file.filename}`;

    try {
        await fs.mkdir(targetFolder, { recursive: true });
        await fs.rename(file.path, targetPath);
    } catch (error) {
        logger.error('No se pudo guardar el archivo en el servidor', {
            originalName: file.originalname,
            targetPath,
            cause: error.message
        });
        throw new AppError(ErrorDictionary.FILE_SAVE_ERROR);
    }

    return {
        originalName: file.originalname,
        fileName: file.filename,
        path: targetPath,
        mimeType: file.mimetype,
        size: file.size,
        type: documentType,
        uploadedAt: new Date()
    };
}

export async function removeFile(filePath) {
    if (!filePath) {
        return;
    }

    try {
        await fs.rm(filePath, { force: true });
    } catch (error) {
        logger.warning(`No se pudo borrar el archivo ${filePath}`, { cause: error.message });
    }
}
