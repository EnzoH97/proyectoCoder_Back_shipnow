import mongoose from 'mongoose';
import { DOCUMENT_TYPES, ALLOWED_MIME_TYPES } from '../constants/constants.js';

const fileSchema = new mongoose.Schema({
    originalName: {
        type: String,
        required: [true, 'El nombre original del archivo es obligatorio']
    },
    fileName: {
        type: String,
        required: [true, 'El nombre generado del archivo es obligatorio']
    },
    path: {
        type: String,
        required: [true, 'La ruta del archivo es obligatoria']
    },
    mimeType: {
        type: String,
        required: [true, 'El tipo de archivo es obligatorio'],
        enum: Object.keys(ALLOWED_MIME_TYPES)
    },
    size: {
        type: Number,
        required: [true, 'El tamaño del archivo es obligatorio'],
        min: [0, 'El tamaño del archivo no puede ser negativo']
    },
    type: {
        type: String,
        required: [true, 'El tipo de documento es obligatorio'],
        enum: Object.values(DOCUMENT_TYPES)
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

export default fileSchema;
