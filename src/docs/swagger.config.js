import swaggerJSDoc from 'swagger-jsdoc';
import config from '../config/config.js';
import { ErrorDictionary } from '../utils/errors.js';
import {
    USER_ROLES,
    ORDER_STATUS,
    DELIVERY_STATUS,
    DELIVERY_PRIORITY,
    DOCUMENT_TYPES,
    ALLOWED_MIME_TYPES,
    LOG_LEVELS
} from '../constants/constants.js';

// Configuración de Swagger/OpenAPI. Está separada de las rutas: los endpoints se describen
// en los archivos .yaml de esta carpeta y acá se arma la especificación completa.
//
// Los enums (roles, estados, prioridades, niveles de log y códigos de error) salen de las mismas
// constantes que usa la API, así la documentación no se desactualiza si cambian.

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'ShipNow API',
            version: '1.0.0',
            description: [
                'API REST de ShipNow para gestionar **usuarios**, **pedidos** y **entregas** de una plataforma de envíos.',
                '',
                'Propósito de esta documentación: consultar y probar los endpoints desde el navegador (botón *Try it out*).',
                '',
                '- **Respuestas exitosas:** `{ "status": "success", "payload": ... }`',
                '- **Errores:** siempre `{ "status": "error", "code": "...", "message": "...", "details": [] }`',
                '- **Autenticación:** la API no requiere autenticación.',
                '- **Mocks y Logger:** son herramientas de prueba y validación, no funcionalidades de negocio.'
            ].join('\n')
        },
        servers: [
            {
                url: `http://localhost:${config.port}`,
                description: 'Servidor local'
            }
        ],
        tags: [
            { name: 'Users', description: 'Gestión de usuarios (clientes, repartidores, tiendas y administradores) y carga de sus documentos' },
            { name: 'Orders', description: 'Gestión de pedidos' },
            { name: 'Deliveries', description: 'Gestión de entregas de los pedidos y carga de sus comprobantes' },
            { name: 'Mocks', description: 'Datos simulados para pruebas: devolverlos sin guardar o cargarlos en MongoDB' },
            { name: 'Logger', description: 'Herramienta interna para validar el logger (no es parte del negocio)' }
        ],
        components: {
            schemas: {
                UserRole: { type: 'string', enum: Object.values(USER_ROLES), example: USER_ROLES.CUSTOMER },
                OrderStatus: { type: 'string', enum: Object.values(ORDER_STATUS), example: ORDER_STATUS.CREATED },
                DeliveryStatus: { type: 'string', enum: Object.values(DELIVERY_STATUS), example: DELIVERY_STATUS.PENDING },
                DeliveryPriority: { type: 'string', enum: Object.values(DELIVERY_PRIORITY), example: DELIVERY_PRIORITY.NORMAL },
                DocumentType: { type: 'string', enum: Object.values(DOCUMENT_TYPES), example: DOCUMENT_TYPES.USER_DOCUMENT },
                FileMimeType: { type: 'string', enum: Object.keys(ALLOWED_MIME_TYPES), example: 'application/pdf' },
                LogLevel: { type: 'string', enum: Object.values(LOG_LEVELS), example: LOG_LEVELS.INFO },
                ErrorCode: {
                    type: 'string',
                    description: 'Código estable del error (claves del diccionario de errores)',
                    enum: Object.values(ErrorDictionary).map((error) => error.code),
                    example: ErrorDictionary.ORDER_NOT_FOUND.code
                }
            }
        }
    },
    // las rutas son relativas a la carpeta desde donde se inicia el servidor (la raíz del proyecto)
    apis: ['./src/docs/*.yaml']
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

export default swaggerSpec;
