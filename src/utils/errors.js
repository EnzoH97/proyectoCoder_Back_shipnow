
export const ErrorDictionary = Object.freeze({
    // ---------- genéricos ----------
    INTERNAL_SERVER_ERROR: { statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' },
    ROUTE_NOT_FOUND: { statusCode: 404, code: 'ROUTE_NOT_FOUND', message: 'Ruta no encontrada' },
    INVALID_ID: { statusCode: 400, code: 'INVALID_ID', message: 'El id proporcionado no es válido' },
    INVALID_JSON: { statusCode: 400, code: 'INVALID_JSON', message: 'El cuerpo de la petición no es un JSON válido' },
    VALIDATION_ERROR: { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Los datos enviados no son válidos' },
    DUPLICATE_KEY: { statusCode: 409, code: 'DUPLICATE_KEY', message: 'Ya existe un registro con esos datos' },
    CONFIG_ERROR: { statusCode: 500, code: 'CONFIG_ERROR', message: 'Configuración inválida: falta API Key' },

    // ---------- usuarios ----------
    USER_NOT_FOUND: { statusCode: 404, code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' },
    ADMIN_CREATION_FORBIDDEN: { statusCode: 403, code: 'ADMIN_CREATION_FORBIDDEN', message: 'No se puede crear un admin desde este endpoint' },
    EMAIL_ALREADY_EXISTS: { statusCode: 409, code: 'EMAIL_ALREADY_EXISTS', message: 'Ya existe un usuario con ese email' },
    INVALID_USER_ROLE: { statusCode: 400, code: 'INVALID_USER_ROLE', message: 'El rol indicado no es válido' },

    // ---------- pedidos ----------
    ORDER_NOT_FOUND: { statusCode: 404, code: 'ORDER_NOT_FOUND', message: 'Pedido no encontrado' },
    CUSTOMER_NOT_FOUND: { statusCode: 404, code: 'CUSTOMER_NOT_FOUND', message: 'El cliente especificado no existe' },
    ORDER_WITHOUT_ITEMS: { statusCode: 400, code: 'ORDER_WITHOUT_ITEMS', message: 'El pedido debe tener al menos un item' },
    INVALID_ORDER_ITEMS: { statusCode: 400, code: 'INVALID_ORDER_ITEMS', message: 'Los items del pedido no son válidos' },
    INVALID_ORDER_STATUS: { statusCode: 400, code: 'INVALID_ORDER_STATUS', message: 'El estado del pedido no es válido' },
    INVALID_PRIORITY: { statusCode: 400, code: 'INVALID_PRIORITY', message: 'La prioridad indicada no es válida' },

    // ---------- entregas ----------
    DELIVERY_NOT_FOUND: { statusCode: 404, code: 'DELIVERY_NOT_FOUND', message: 'Entrega no encontrada' },
    DRIVER_NOT_FOUND: { statusCode: 404, code: 'DRIVER_NOT_FOUND', message: 'El repartidor especificado no existe' },
    USER_NOT_DRIVER: { statusCode: 400, code: 'USER_NOT_DRIVER', message: 'El usuario indicado no tiene rol de repartidor' },
    INVALID_DELIVERY_STATUS: { statusCode: 400, code: 'INVALID_DELIVERY_STATUS', message: 'El estado de la entrega no es válido' },

    // ---------- mocks ----------
    QTY_NOT_INTEGER: { statusCode: 400, code: 'QTY_NOT_INTEGER', message: 'La cantidad debe ser un número entero' },
    QTY_NEGATIVE: { statusCode: 400, code: 'QTY_NEGATIVE', message: 'La cantidad no puede ser negativa' },
    QTY_OUT_OF_RANGE: { statusCode: 400, code: 'QTY_OUT_OF_RANGE', message: 'La cantidad está fuera del rango permitido' },
    INVALID_MOCK_COLLECTION: { statusCode: 400, code: 'INVALID_MOCK_COLLECTION', message: 'La colección indicada para el seed no es válida' },
    NO_CUSTOMERS_FOR_MOCK: { statusCode: 409, code: 'NO_CUSTOMERS_FOR_MOCK', message: 'No hay clientes en la base para generar pedidos. Ejecutá primero el seed de usuarios' },
    NO_PENDING_ORDERS_FOR_MOCK: { statusCode: 409, code: 'NO_PENDING_ORDERS_FOR_MOCK', message: 'No hay pedidos sin entrega. Ejecutá primero el seed de pedidos' },
    NO_DRIVERS_FOR_MOCK: { statusCode: 409, code: 'NO_DRIVERS_FOR_MOCK', message: 'No hay repartidores en la base. Ejecutá primero el seed de repartidores' },
    MOCK_SEED_FAILED: { statusCode: 500, code: 'MOCK_SEED_FAILED', message: 'Falló la carga de datos de prueba en MongoDB' }
});

class AppError extends Error {
    // errorDef: una entrada de ErrorDictionary. details: información extra (campo, valor recibido, etc.)
    constructor(errorDef, details = []) {
        const def = errorDef && typeof errorDef === 'object' ? errorDef : ErrorDictionary.INTERNAL_SERVER_ERROR;
        super(def.message);
        this.name = 'AppError';
        this.statusCode = def.statusCode;
        this.code = def.code;
        this.details = Array.isArray(details) ? details : [];
    }
}

export default AppError;

