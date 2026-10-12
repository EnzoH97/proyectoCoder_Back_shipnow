# ShipNow API

## 1. Descripción del proyecto

ShipNow es una API REST para gestionar envíos. Permite administrar **usuarios** (clientes, repartidores, tiendas y administradores), **pedidos** y **entregas**, y está organizada por capas para separar responsabilidades.

Incluye un **módulo de mocking** (`/api/mocks`) que genera datos simulados (usuarios, repartidores, pedidos y entregas) y permite cargarlos en MongoDB de forma controlada, sin tener que crearlos a mano. Los datos respetan los modelos reales, las relaciones entre entidades y las constantes del proyecto (roles, estados y prioridades).

## 2. Tecnologías utilizadas

| Tecnología | Uso |
| --- | --- |
| Node.js 18+ | Entorno de ejecución (módulos ES) |
| Express 4 | Servidor y ruteo |
| MongoDB + Mongoose 8 | Base de datos y modelado |
| dotenv | Variables de entorno |
| cors | Habilitar peticiones desde otros orígenes |
| nodemon | Reinicio automático en desarrollo |

## 3. Estructura del proyecto

Arquitectura por capas: `routes → controllers → services → repositories → models`.

```
shipnow/
├── src/
│   ├── app.js                      # Configuración de Express, middlewares y manejo de errores
│   ├── server.js                   # Conexión a MongoDB y arranque del servidor
│   ├── config/
│   │   └── config.js               # Lectura y validación de variables de entorno
│   ├── constants/
│   │   └── constants.js            # Roles, estados, prioridades y límites del mocking
│   ├── models/                     # Esquemas de Mongoose (user, order, delivery)
│   ├── repositories/               # Acceso a datos (users, orders, deliveries)
│   ├── services/                   # Lógica de negocio (users, orders, deliveries, mocks)
│   ├── controllers/                # Reciben la request y responden (users, orders, deliveries, mocks)
│   ├── routes/                     # Routers de Express (users, orders, deliveries, mocks)
│   └── utils/
│       ├── errors.js               # Clase AppError
│       └── mockData.js             # Datos base y helpers de azar para el mocking
├── .env.example                    # Ejemplo de variables de entorno
├── .gitignore
├── package.json
└── README.md
```

Archivos del módulo de mocking:

| Capa | Archivo |
| --- | --- |
| Router | `src/routes/mocks.router.js` (montado en `/api/mocks` desde `src/routes/index.js`) |
| Controller | `src/controllers/mocks.controller.js` |
| Service | `src/services/mocks.service.js` |
| Repositories | Método `insertMany` en `users.repo.js`, `orders.repo.js` y `deliveries.repo.js` |
| Datos base | `src/utils/mockData.js` |
| Constantes | `src/constants/constants.js` |

Los roles, estados y prioridades salen siempre de las constantes (`USER_ROLES`, `ORDER_STATUS`, `DELIVERY_STATUS`, `DELIVERY_PRIORITY`). Los modelos también las usan en sus `enum`.

## 4. Instalación y uso

### Requisitos

- Node.js 18 o superior
- MongoDB en local o una URI de MongoDB Atlas

### Pasos

```bash
# 1. Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>
cd shipnow

# 2. Instalar dependencias
npm install

# 3. Crear el archivo de variables de entorno y completarlo
cp .env.example .env      # en Windows PowerShell: Copy-Item .env.example .env

# 4. Levantar el servidor
npm run dev
```

Si todo está bien, la consola muestra `MongoDB conectado` y `Servidor en puerto 8080`.

### Scripts disponibles

| Script | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor con nodemon (desarrollo) |
| `npm start` | Inicia el servidor con Node |

### Probar rápidamente

1. Cargar datos de prueba: `POST /api/mocks/seed?collection=all&qty=5`
2. Ver lo guardado: `GET /api/users`, `GET /api/orders`, `GET /api/deliveries`

## 5. Variables de entorno

Copiá `.env.example` a `.env` y completá los valores. El archivo `.env` no se sube al repositorio.

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `MONGODB_URI` | Sí | URI de conexión, por ejemplo `mongodb://localhost:27017/shipnow` |
| `JWT_SECRET` | Sí | Secreto de la aplicación |
| `PORT` | No | Puerto del servidor (por defecto `8080`) |
| `NODE_ENV` | No | `development` o `production` (por defecto `development`). En `production` el costo de envío se calcula como `50 + 1%` del valor declarado; en otros entornos es `10` |
| `LOG_LEVEL` | No | Nivel de logs (por defecto `debug`) |

Si falta una variable obligatoria, la app no arranca y muestra un mensaje indicando cuál.

## 6. Endpoints

Las respuestas exitosas tienen la forma `{ "status": "success", "payload": ... }`. Los errores tienen la forma `{ "status": "error", "message": "..." }`.

### General

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Estado del servidor |

### Usuarios, pedidos y entregas

Los tres recursos tienen el mismo CRUD:

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/users` · `/api/orders` · `/api/deliveries` | Listar |
| GET | `/api/<recurso>/:id` | Obtener por id (404 si no existe) |
| POST | `/api/<recurso>` | Crear |
| PUT | `/api/<recurso>/:id` | Actualizar |
| DELETE | `/api/<recurso>/:id` | Eliminar |

Reglas de negocio:

- **Usuarios:** el email es único y no se puede crear un usuario con rol `admin` desde este endpoint.
- **Pedidos:** el cliente debe existir y tener al menos un item. Se calculan `declaredValue`, `shippingCost` y `total`, y el pedido se crea en estado `created`.
- **Entregas:** el pedido debe existir y, si se indica un repartidor, debe tener rol `driver`.

### Mocking (`/api/mocks`)

Parámetro `qty`: cantidad a generar. Por defecto **5**, mínimo 1 y máximo **100**. Si no es válido, responde `400`.

#### Datos simulados sin guardar (GET)

| Ruta | Qué devuelve |
| --- | --- |
| `GET /api/mocks/users?qty=2` | Usuarios con roles repartidos entre `customer`, `driver` y `store` (nunca `admin`) |
| `GET /api/mocks/drivers?qty=3` | Usuarios con rol `driver` |
| `GET /api/mocks/orders?qty=5` | Pedidos con estado y prioridad permitidos, items, total y costo de envío |
| `GET /api/mocks/deliveries?qty=5` | Entregas con su pedido y, si corresponde, su repartidor |
| `GET /api/mocks/dataset?users=5&drivers=2&orders=10` | Todo junto y relacionado entre sí (los ids se corresponden) |

Ejemplo:

```bash
curl "http://localhost:8080/api/mocks/users?qty=2"
```

```json
{
  "status": "success",
  "payload": [
    { "_id": "…", "firstName": "Lucía", "lastName": "Sosa", "email": "lucia.sosa.a1b2c3@test.com", "password": "Mock1234", "role": "customer", "documents": [] },
    { "_id": "…", "firstName": "Diego", "lastName": "Torres", "email": "diego.torres.d4e5f6@test.com", "password": "Mock1234", "role": "driver", "documents": [] }
  ]
}
```

Los GET de `users`, `drivers`, `orders` y `deliveries` se generan por separado, así que sus ids no se cruzan entre sí. Para ver las relaciones usá `/dataset`.

#### Cargar datos de prueba en MongoDB (POST)

`POST /api/mocks/seed?collection=<tipo>&qty=<n>`

| `collection` | Qué inserta |
| --- | --- |
| `users` (por defecto) | Usuarios con roles `customer`, `driver` y `store` |
| `drivers` | Usuarios con rol `driver` |
| `orders` | Pedidos en estado `created` para clientes que ya existen en la base |
| `deliveries` | Entregas para pedidos `created` sin entrega; también actualiza el pedido (`delivery` y estado) |
| `all` | Todo lo anterior en orden: usuarios → repartidores → pedidos → entregas |

```bash
curl -X POST "http://localhost:8080/api/mocks/seed?qty=10"
```

```json
{ "status": "success", "insertados": 10, "coleccion": "usuarios" }
```

En PowerShell:

```powershell
Invoke-RestMethod -Method Post "http://localhost:8080/api/mocks/seed?qty=10"
```

Con `collection=all` la respuesta trae el detalle de cada colección dentro de `resultados`.

Orden recomendado para cargar por partes: `users` → `drivers` → `orders` → `deliveries`. Si falta una dependencia (por ejemplo, no hay clientes para crear pedidos), responde `400` con un mensaje que indica qué cargar primero.

#### Relaciones que se respetan

- `order.customer` apunta siempre a un usuario con rol `customer`.
- `delivery.order` apunta a un pedido existente y `order.delivery` apunta de vuelta a esa entrega.
- `delivery.driver` es siempre un usuario con rol `driver`. Las entregas `pending` no tienen repartidor.
- El estado de la entrega es coherente con el del pedido:

| Pedido | Entrega |
| --- | --- |
| `created` | `pending` (o todavía sin entrega) |
| `assigned`, `picked_up` | `assigned` (con repartidor) |
| `in_transit` | `in_transit` |
| `delivered` | `delivered` (con `deliveredAt`) |
| `cancelled` | sin entrega |

- `total = declaredValue + shippingCost`, con el mismo cálculo de envío que usa el alta real de pedidos.

#### Notas

- Los usuarios de prueba tienen la contraseña `Mock1234` y emails `@test.com`. La API guarda las contraseñas tal cual vienen (sin hash).
- El seed agrega datos, no borra nada. Para empezar de cero se puede eliminar la base desde Mongo (`db.dropDatabase()`).
- El límite de 100 por request evita llenar la base por error.
