import crypto from 'crypto';

// Datos base y helpers de azar. Sin dependencias externas.
// No conoce roles ni estados: eso lo decide el service con las constantes.

export const MOCK_PASSWORD = 'Mock1234';
export const MOCK_EMAIL_DOMAIN = 'test.com';

const FIRST_NAMES = ['Ana', 'Luis', 'María', 'Juan', 'Lucía', 'Martín', 'Sofía', 'Diego', 'Valentina', 'Mateo', 'Camila', 'Nicolás', 'Julieta', 'Federico', 'Carolina', 'Santiago'];
const LAST_NAMES = ['Pérez', 'Gómez', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Sosa', 'Álvarez', 'Torres', 'Ruiz', 'Díaz', 'Romero', 'Acosta', 'Molina', 'Herrera', 'Castro'];
const STREETS = ['San Martín', 'Belgrano', 'Las Heras', 'Colón', 'Sarmiento', 'Rivadavia', 'Mitre', 'España', 'Godoy Cruz', 'Aristides Villanueva'];
const CITIES = ['Mendoza', 'Godoy Cruz', 'Guaymallén', 'Las Heras', 'Luján de Cuyo', 'Maipú'];
const ITEMS = [
    { name: 'Zapatillas running', min: 40000, max: 120000 },
    { name: 'Auriculares bluetooth', min: 15000, max: 60000 },
    { name: 'Mochila urbana', min: 12000, max: 35000 },
    { name: 'Termo acero 1L', min: 9000, max: 25000 },
    { name: 'Libro de cocina', min: 6000, max: 18000 },
    { name: 'Cargador USB-C', min: 4000, max: 14000 },
    { name: 'Remera algodón', min: 7000, max: 20000 },
    { name: 'Botella de vino Malbec', min: 5000, max: 30000 }
];

export const int = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const pick = (list) => list[int(0, list.length - 1)];
export const chance = (p) => Math.random() < p;

// string hexadecimal de 24 caracteres: Mongoose lo acepta como ObjectId válido
export const newId = () => crypto.randomBytes(12).toString('hex');

const slug = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function randomPerson() {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    // el sufijo evita choques con el índice unique de email
    const email = `${slug(firstName)}.${slug(lastName)}.${crypto.randomBytes(3).toString('hex')}@${MOCK_EMAIL_DOMAIN}`;
    return { firstName, lastName, email };
}

export const randomAddress = () => `${pick(STREETS)} ${int(100, 4999)}, ${pick(CITIES)}`;

export function randomItems() {
    return Array.from({ length: int(1, 4) }, () => {
        const item = pick(ITEMS);
        return {
            name: item.name,
            quantity: int(1, 3),
            price: Math.round(int(item.min, item.max) / 100) * 100
        };
    });
}

export const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000);
