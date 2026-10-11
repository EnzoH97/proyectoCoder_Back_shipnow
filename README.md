# ShipNow API

API de ShipNow con Node.js, Express y MongoDB, organizada por capas:

```
routes → controllers → services → repositories → models
```

Incluye un **módulo de mocking** (`/api/mocks`) para generar usuarios, repartidores, pedidos y entregas de prueba sin cargarlos a mano.

## Requisitos

- Node.js 18+
- MongoDB en local (o una URI de Atlas)

## Instalación

```bash
npm install
cp .env.example .env     # completá los valores
npm run dev
```

Variables de entorno (`.env`):

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto del servidor (por defecto 8080) |
| `MONGODB_URI` | URI de conexión, ej. `mongodb://localhost:27017/shipnow` |
| `JWT_SECRET` | Secreto de la app (obligatorio) |
| `NODE_ENV` | `development` o `production` |

## Endpoints principales

| Ruta | Descripción |
| --- | --- |
| `GET /api/health` | Health check |
| `/api/users`, `/api/orders`, `/api/deliveries` | CRUD de cada entidad |
| `/api/mocks/...` | Mocking (ver abajo) |

## Módulo de mocking

Dónde está cada parte:

| Capa | Archivo |
| --- | --- |
| Router | `src/routes/mocks.router.js` (montado en `/api/mocks` desde `src/routes/index.js`) |
| Controller | `src/controllers/mocks.controller.js` (solo lee la request y responde) |
| Service | `src/services/mocks.service.js` (genera los datos y decide las reglas) |
| Repositories | `insertMany` en `users.repo.js`, `orders.repo.js`, `deliveries.repo.js` |
| Datos base | `src/utils/mockData.js` (nombres, direcciones, productos y helpers de azar) |
| Constantes | `src/constants/constants.js` (roles, estados, prioridades y límites del mock) |

Los roles, estados y prioridades salen siempre de las constantes (`USER_ROLES`, `ORDER_STATUS`, `DELIVERY_STATUS`, `DELIVERY_PRIORITY`). Los modelos de Mongoose también usan esas constantes en sus `enum`.

### Parámetro `qty`

Cantidad a generar. Por defecto **5**, mínimo 1, máximo **100**. Si el valor no es válido responde `400`.

### 1. Generar datos sin guardarlos (GET)

| Ruta | Qué devuelve |
| --- | --- |
| `GET /api/mocks/users?qty=2` | Usuarios con roles repartidos entre `customer`, `driver` y `store` (nunca `admin`) |
| `GET /api/mocks/drivers?qty=3` | Usuarios con rol `driver` |
| `GET /api/mocks/orders?qty=5` | Pedidos con estado y prioridad permitidos, items, total y costo de envío |
| `GET /api/mocks/deliveries?qty=5` | Entregas con su pedido y, si corresponde, su repartidor |
| `GET /api/mocks/dataset?users=5&drivers=2&orders=10` | Todo junto y **relacionado entre sí** (los ids de pedidos, entregas, clientes y repartidores se corresponden) |

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

### 2. Cargar datos de prueba en MongoDB (POST)

`POST /api/mocks/seed?collection=<tipo>&qty=<n>`

| `collection` | Qué inserta |
| --- | --- |
| `users` (por defecto) | Usuarios con roles `customer`, `driver` y `store` |
| `drivers` | Usuarios con rol `driver` |
| `orders` | Pedidos en estado `created` para clientes que **ya existen** en la base |
| `deliveries` | Entregas para pedidos `created` que todavía no tienen entrega; también actualiza el pedido (`delivery` y estado) |
| `all` | Todo lo anterior en orden: usuarios → repartidores → pedidos → entregas |

```bash
curl -X POST "http://localhost:8080/api/mocks/seed?qty=10"
```

```json
{ "status": "success", "insertados": 10, "coleccion": "usuarios" }
```

Con `collection=all` la respuesta trae el detalle de cada colección dentro de `resultados`.

Orden recomendado para cargar por partes: `users` → `drivers` → `orders` → `deliveries` (o directamente `all`). Si falta alguna dependencia (por ejemplo, no hay clientes para crear pedidos) responde `400` con un mensaje que indica qué cargar primero.

### Relaciones que se respetan

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

### Notas

- Los usuarios de prueba tienen la contraseña `Mock1234` y emails `@test.com`. Hoy la API guarda las contraseñas tal cual vienen (sin hash).
- El seed **agrega** datos, no borra nada. Para empezar de cero eliminá la base desde Mongo (`db.dropDatabase()`).
- El límite de 100 por request evita llenar la base por error.
