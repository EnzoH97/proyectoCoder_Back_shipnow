export const NODE_ENVS = Object.freeze({
    DEVELOPMENT: 'development',
    PRODUCTION: 'production'
});

export const USER_ROLES = Object.freeze({
    ADMIN: 'admin',
    CUSTOMER: 'customer',
    DRIVER: 'driver',
    STORE: 'store'
});

export const ORDER_STATUS = Object.freeze({
    CREATED: 'created',
    ASSIGNED: 'assigned',
    PICKED_UP: 'picked_up',
    IN_TRANSIT: 'in_transit',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled'
});

export const DELIVERY_STATUS = Object.freeze({
    PENDING: 'pending',
    ASSIGNED: 'assigned',
    IN_TRANSIT: 'in_transit',
    DELIVERED: 'delivered'
});

export const DELIVERY_PRIORITY = Object.freeze({
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high'
});

export const DOCUMENT_TYPES = Object.freeze({
    USER_DOCUMENT: 'user_document',
    DRIVER_LICENSE: 'driver_license',
    DELIVERY_PROOF: 'delivery_proof'
});

// Relación de estados: estado del pedido -> estado de la entrega que le corresponde.
// null = el pedido no tiene entrega (todavía, o nunca si fue cancelado).
export const DELIVERY_STATUS_BY_ORDER_STATUS = Object.freeze({
    [ORDER_STATUS.CREATED]: DELIVERY_STATUS.PENDING,
    [ORDER_STATUS.ASSIGNED]: DELIVERY_STATUS.ASSIGNED,
    [ORDER_STATUS.PICKED_UP]: DELIVERY_STATUS.ASSIGNED,
    [ORDER_STATUS.IN_TRANSIT]: DELIVERY_STATUS.IN_TRANSIT,
    [ORDER_STATUS.DELIVERED]: DELIVERY_STATUS.DELIVERED,
    [ORDER_STATUS.CANCELLED]: null
});

// Inversa: cuando se crea una entrega, cómo queda el pedido asociado.
export const ORDER_STATUS_BY_DELIVERY_STATUS = Object.freeze({
    [DELIVERY_STATUS.PENDING]: ORDER_STATUS.CREATED,
    [DELIVERY_STATUS.ASSIGNED]: ORDER_STATUS.ASSIGNED,
    [DELIVERY_STATUS.IN_TRANSIT]: ORDER_STATUS.IN_TRANSIT,
    [DELIVERY_STATUS.DELIVERED]: ORDER_STATUS.DELIVERED
});

// Módulo de mocking
export const MOCK_LIMITS = Object.freeze({
    DEFAULT_QTY: 5,
    MAX_QTY: 100
});

// valores que acepta ?collection= en el seed
export const MOCK_COLLECTIONS = Object.freeze({
    USERS: 'users',
    DRIVERS: 'drivers',
    ORDERS: 'orders',
    DELIVERIES: 'deliveries',
    ALL: 'all'
});

// nombre que se muestra en la respuesta del seed
export const MOCK_COLLECTION_LABELS = Object.freeze({
    [MOCK_COLLECTIONS.USERS]: 'usuarios',
    [MOCK_COLLECTIONS.DRIVERS]: 'repartidores',
    [MOCK_COLLECTIONS.ORDERS]: 'pedidos',
    [MOCK_COLLECTIONS.DELIVERIES]: 'entregas',
    [MOCK_COLLECTIONS.ALL]: 'todas'
});
