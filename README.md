# ShipNow API

## 1. Descripción del proyecto

ShipNow es una API REST para gestionar envíos. Permite administrar **usuarios** (clientes, repartidores, tiendas y administradores), **pedidos** y **entregas**, y está organizada por capas para separar responsabilidades.

Registra lo que ocurre en el servidor con un **logger centralizado (Winston)**, con niveles, archivos de log y rotación (ver [8. Logging y monitoreo](#8-logging-y-monitoreo)).

Incluye un **módulo de mocking** (`/api/mocks`) que genera datos simulados (usuarios, repartidores, pedidos y entregas) y permite cargarlos en MongoDB de forma controlada, sin tener que crearlos a mano. Los datos respetan los modelos reales, las relaciones entre entidades y las constantes del proyecto (roles, estados y prioridades).

## 2. Tecnologías utilizadas

| Tecnología | Uso |
| --- | --- |
| Node.js 18+ | Entorno de ejecución (módulos ES) |
| Express 4 | Servidor y ruteo |
| MongoDB + Mongoose 8 | Base de datos y modelado |
| dotenv | Variables de entorno |
| cors | Habilitar peticiones desde otros orígenes |
| winston | Logger centralizado con niveles de log |
| winston-daily-rotate-file | Archivos de log con rotación diaria |
| nodemon | Reinicio automático en desarrollo |

## 3. Estructura del proyecto

Arquitectura por capas: `routes → controllers → services → repositories → models`.

```
shipnow/
├── src/
│   ├── app.js                      # Configuración de Express; registra el manejo de errores al final
│   ├── server.js                   # Conexión a MongoDB y arranque del servidor
│   ├── config/
│   │   └── config.js               # Lectura y validación de variables de entorno
│   ├── constants/
│   │   └── constants.js            # Roles, estados, prioridades, entornos y límites del mocking
│   ├── models/                     # Esquemas de Mongoose (user, order, delivery)
│   ├── repositories/               # Acceso a datos (users, orders, deliveries)
│   ├── services/                   # Lógica de negocio (users, orders, deliveries, mocks, logger)
│   ├── controllers/                # Reciben la request y responden (users, orders, deliveries, mocks, logger)
│   ├── routes/                     # Routers de Express (users, orders, deliveries, mocks, logger)
│   ├── middlewares/
│   │   ├── errorHandler.js         # Middleware global: único lugar que responde errores (y los registra en el log)
│   │   ├── requestLogger.js        # Registra cada petición HTTP (nivel http)
│   │   └── routeNotFound.js        # Deriva las rutas inexistentes al errorHandler
│   └── utils/
│       ├── errors.js               # ErrorDictionary (diccionario de errores) y clase AppError
│       ├── logger.js               # Configuración única de Winston (niveles, formato, consola, archivos y rotación)
│       └── mockData.js             # Datos base y helpers de azar para el mocking
├── logs/                           # Archivos de log generados por la app (se ignoran en Git, solo se versiona .gitkeep)
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
git clone https://github.com/EnzoH97/proyectoCoder_Back_shipnow
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
| `NODE_ENV` | No | `development` o `production` (por defecto `development`) |
| `LOG_LEVEL` | No | Nivel mínimo de log: `fatal`, `error`, `warning`, `info`, `http` o `debug`. Si no se define: `debug` en `development` e `info` en `production` |

Si falta una variable obligatoria, la app no arranca: registra un log `fatal` indicando cuál falta y termina.

## 6. Endpoints

Las respuestas exitosas tienen la forma `{ "status": "success", "payload": ... }`. Los errores siempre tienen la misma estructura (ver [7. Manejo de errores](#7-manejo-de-errores)).

### General

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Estado del servidor |
| GET | `/api/logger/test` | Herramienta interna: genera un log de cada nivel para probar el logger (ver [8. Logging y monitoreo](#8-logging-y-monitoreo)) |

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

- **Usuarios:** el email es único, el rol debe ser uno de los válidos y no se puede crear un usuario con rol `admin` desde este endpoint.
- **Pedidos:** el cliente debe existir y el pedido debe tener al menos un item válido (cantidad entera ≥ 1, precio ≥ 0). El estado y la prioridad deben ser valores permitidos. Se calculan `declaredValue`, `shippingCost` y `total`, y el pedido se crea en estado `created`.
- **Entregas:** el pedido debe existir y, si se indica un repartidor, debe existir y tener rol `driver`. El estado y la prioridad deben ser valores permitidos.

### Mocking (`/api/mocks`)

Parámetro `qty`: cantidad a generar. Por defecto **5**, mínimo 1 y máximo **100**. Si no es válido responde `400` con un código que indica el motivo (`QTY_NOT_INTEGER`, `QTY_NEGATIVE` o `QTY_OUT_OF_RANGE`). Lo mismo aplica a `users`, `drivers` y `orders` en `/dataset`.

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

Orden recomendado para cargar por partes: `users` → `drivers` → `orders` → `deliveries`. Si falta una dependencia (por ejemplo, no hay clientes para crear pedidos), responde `409` con un mensaje que indica qué cargar primero. Si MongoDB falla durante la carga, responde `500` con el código `MOCK_SEED_FAILED`.

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

## 7. Manejo de errores

Todos los errores de la API pasan por una capa común, formada por tres piezas:

| Pieza | Archivo | Qué hace |
| --- | --- | --- |
| Diccionario de errores | `src/utils/errors.js` (`ErrorDictionary`) | Define cada error del dominio con su `statusCode` HTTP, su `code` y su `message` |
| Error personalizado | `src/utils/errors.js` (`AppError`) | Se crea con una entrada del diccionario: `new AppError(ErrorDictionary.USER_NOT_FOUND)` |
| Middleware global | `src/middlewares/errorHandler.js` | Convierte cualquier error en la respuesta HTTP uniforme |

Cómo fluye un error:

```
service detecta el problema → throw new AppError(...) → controller (catch → next(error)) → errorHandler → respuesta JSON
```

- Los **services** detectan los errores (usuario inexistente, estado inválido, cantidad incorrecta, etc.) y los lanzan.
- Los **controllers** y **routers** no arman respuestas de error: solo hacen `next(error)`.
- El **errorHandler** es el único lugar que responde un error al cliente. También traduce errores de Mongoose y de Express (id mal formado, validación del modelo, email duplicado, JSON inválido) al mismo formato.
- Cualquier error no previsto responde `500` con un mensaje genérico. El detalle interno solo se muestra en la consola del servidor.

### Estructura de la respuesta de error

Todas las respuestas de error tienen exactamente estos campos:

```json
{
  "status": "error",
  "code": "QTY_NEGATIVE",
  "message": "La cantidad no puede ser negativa",
  "details": [
    { "field": "qty", "received": "-5", "min": 1 }
  ]
}
```

| Campo | Descripción |
| --- | --- |
| `status` | Siempre `"error"` |
| `code` | Código estable del error (clave del diccionario), pensado para que lo use un cliente |
| `message` | Descripción legible |
| `details` | Arreglo con información adicional (campo, valor recibido, valores permitidos). Es `[]` si no hay nada que agregar |

### Errores definidos

| Código | HTTP | Cuándo ocurre |
| --- | --- | --- |
| `ROUTE_NOT_FOUND` | 404 | La ruta no existe |
| `INVALID_ID` | 400 | El id no tiene formato válido |
| `INVALID_JSON` | 400 | El cuerpo de la petición no es un JSON válido |
| `VALIDATION_ERROR` | 400 | Falló la validación del modelo (faltan campos obligatorios, etc.) |
| `DUPLICATE_KEY` | 409 | Se viola un índice único |
| `INTERNAL_SERVER_ERROR` | 500 | Error inesperado |
| `CONFIG_ERROR` | 500 | Falta configuración necesaria (API Key) |
| `USER_NOT_FOUND` | 404 | El usuario no existe |
| `ADMIN_CREATION_FORBIDDEN` | 403 | Se intenta crear un `admin` desde la API |
| `EMAIL_ALREADY_EXISTS` | 409 | El email ya está registrado |
| `INVALID_USER_ROLE` | 400 | El rol no es uno de los permitidos |
| `ORDER_NOT_FOUND` | 404 | El pedido no existe |
| `CUSTOMER_NOT_FOUND` | 404 | El cliente del pedido no existe |
| `ORDER_WITHOUT_ITEMS` | 400 | El pedido no tiene items |
| `INVALID_ORDER_ITEMS` | 400 | Algún item tiene nombre vacío, cantidad inválida o precio negativo |
| `INVALID_ORDER_STATUS` | 400 | El estado del pedido no es válido |
| `INVALID_PRIORITY` | 400 | La prioridad no es válida |
| `DELIVERY_NOT_FOUND` | 404 | La entrega no existe |
| `DRIVER_NOT_FOUND` | 404 | El repartidor indicado no existe |
| `USER_NOT_DRIVER` | 400 | El usuario indicado no tiene rol `driver` |
| `INVALID_DELIVERY_STATUS` | 400 | El estado de la entrega no es válido |
| `QTY_NOT_INTEGER` | 400 | Mocks: la cantidad no es un número entero |
| `QTY_NEGATIVE` | 400 | Mocks: la cantidad es negativa |
| `QTY_OUT_OF_RANGE` | 400 | Mocks: la cantidad es 0 o supera el máximo (100) |
| `INVALID_MOCK_COLLECTION` | 400 | Mocks: el valor de `collection` no existe |
| `NO_CUSTOMERS_FOR_MOCK` | 409 | Mocks: se piden pedidos y no hay clientes cargados |
| `NO_PENDING_ORDERS_FOR_MOCK` | 409 | Mocks: se piden entregas y no hay pedidos sin entrega |
| `NO_DRIVERS_FOR_MOCK` | 409 | Mocks: se piden entregas y no hay repartidores cargados |
| `MOCK_SEED_FAILED` | 500 | Mocks: falló la carga en MongoDB |

### Cómo probar los casos inválidos

Con el servidor levantado (`npm run dev`), probá estas peticiones. En PowerShell, `try/catch` permite ver el cuerpo del error; si usás `curl`, agregá `-i` para ver también el código HTTP.

**Mocks**

| Caso | Petición | Respuesta esperada |
| --- | --- | --- |
| Cantidad no numérica | `GET /api/mocks/users?qty=abc` | 400 `QTY_NOT_INTEGER` |
| Cantidad decimal | `GET /api/mocks/users?qty=2.5` | 400 `QTY_NOT_INTEGER` |
| Cantidad negativa | `GET /api/mocks/users?qty=-5` | 400 `QTY_NEGATIVE` |
| Cantidad cero | `GET /api/mocks/users?qty=0` | 400 `QTY_OUT_OF_RANGE` |
| Cantidad excesiva | `GET /api/mocks/users?qty=500` | 400 `QTY_OUT_OF_RANGE` |
| Valor negativo en dataset | `GET /api/mocks/dataset?orders=-1` | 400 `QTY_NEGATIVE` |
| Colección inexistente | `POST /api/mocks/seed?collection=foo` | 400 `INVALID_MOCK_COLLECTION` |
| Seed con cantidad negativa | `POST /api/mocks/seed?qty=-3` | 400 `QTY_NEGATIVE` |
| Pedidos sin clientes (base vacía) | `POST /api/mocks/seed?collection=orders` | 409 `NO_CUSTOMERS_FOR_MOCK` |
| Entregas sin pedidos | `POST /api/mocks/seed?collection=deliveries` | 409 `NO_PENDING_ORDERS_FOR_MOCK` |
| Falla de MongoDB | Detené MongoDB y ejecutá `POST /api/mocks/seed?qty=5` | 500 `MOCK_SEED_FAILED` |

**Respuestas de ejemplo (mocks)**

Cantidad negativa: `GET /api/mocks/users?qty=-5` responde `400`:

```json
{
  "status": "error",
  "code": "QTY_NEGATIVE",
  "message": "La cantidad no puede ser negativa",
  "details": [
    { "field": "qty", "received": "-5", "min": 1 }
  ]
}
```

Cantidad no numérica: `GET /api/mocks/users?qty=abc` responde `400`:

```json
{
  "status": "error",
  "code": "QTY_NOT_INTEGER",
  "message": "La cantidad debe ser un número entero",
  "details": [
    { "field": "qty", "received": "abc" }
  ]
}
```

Cantidad mayor al límite: `GET /api/mocks/users?qty=500` responde `400`:

```json
{
  "status": "error",
  "code": "QTY_OUT_OF_RANGE",
  "message": "La cantidad está fuera del rango permitido",
  "details": [
    { "field": "qty", "received": "500", "min": 1, "max": 100 }
  ]
}
```

Colección inexistente: `POST /api/mocks/seed?collection=foo` responde `400`:

```json
{
  "status": "error",
  "code": "INVALID_MOCK_COLLECTION",
  "message": "La colección indicada para el seed no es válida",
  "details": [
    { "field": "collection", "received": "foo", "allowed": ["users", "drivers", "orders", "deliveries", "all"] }
  ]
}
```

Falla de MongoDB durante el seed: `POST /api/mocks/seed?qty=5` con la base caída responde `500` (el motivo exacto depende del error del driver):

```json
{
  "status": "error",
  "code": "MOCK_SEED_FAILED",
  "message": "Falló la carga de datos de prueba en MongoDB",
  "details": [
    { "collection": "users", "reason": "..." }
  ]
}
```

**Usuarios, pedidos y entregas**

| Caso | Petición | Respuesta esperada |
| --- | --- | --- |
| Ruta inexistente | `GET /api/nada` | 404 `ROUTE_NOT_FOUND` |
| Id mal formado | `GET /api/users/abc` | 400 `INVALID_ID` |
| Usuario inexistente | `GET /api/users/000000000000000000000000` | 404 `USER_NOT_FOUND` |
| Pedido inexistente | `GET /api/orders/000000000000000000000000` | 404 `ORDER_NOT_FOUND` |
| Entrega inexistente | `GET /api/deliveries/000000000000000000000000` | 404 `DELIVERY_NOT_FOUND` |
| JSON mal formado | `POST /api/users` con cuerpo `{malformado` | 400 `INVALID_JSON` |
| Crear un admin | `POST /api/users` con `{"role":"admin", ...}` | 403 `ADMIN_CREATION_FORBIDDEN` |
| Rol inválido | `POST /api/users` con `{"role":"superman", ...}` | 400 `INVALID_USER_ROLE` |
| Faltan datos obligatorios | `POST /api/users` con `{"email":"a@a.com"}` | 400 `VALIDATION_ERROR` |
| Pedido sin items | `POST /api/orders` con `"items": []` | 400 `ORDER_WITHOUT_ITEMS` |
| Pedido con precio negativo | `POST /api/orders` con un item con `"price": -5` | 400 `INVALID_ORDER_ITEMS` |
| Estado de pedido inválido | `PUT /api/orders/:id` con `{"status":"volando"}` | 400 `INVALID_ORDER_STATUS` |
| Repartidor que no es `driver` | `POST /api/deliveries` con un `driver` de rol `customer` | 400 `USER_NOT_DRIVER` |

Ejemplos en PowerShell:

```powershell
# error de mocks: cantidad negativa
try { Invoke-RestMethod "http://localhost:8080/api/mocks/users?qty=-5" } catch { $_.ErrorDetails.Message }

# error de seed: colección inexistente
try { Invoke-RestMethod -Method Post "http://localhost:8080/api/mocks/seed?collection=foo" } catch { $_.ErrorDetails.Message }

# JSON mal formado
try { Invoke-RestMethod -Method Post "http://localhost:8080/api/users" -ContentType "application/json" -Body '{malformado' } catch { $_.ErrorDetails.Message }

# intentar crear un admin
try { Invoke-RestMethod -Method Post "http://localhost:8080/api/users" -ContentType "application/json" -Body '{"firstName":"A","lastName":"B","email":"a@b.com","password":"x","role":"admin"}' } catch { $_.ErrorDetails.Message }
```

Ejemplos con curl:

```bash
curl -i "http://localhost:8080/api/mocks/users?qty=-5"
curl -i -X POST "http://localhost:8080/api/mocks/seed?collection=foo"
curl -i "http://localhost:8080/api/users/abc"
```

## 8. Logging y monitoreo

### Herramienta

Se usa **[Winston](https://github.com/winstonjs/winston)** como logger centralizado, con **winston-daily-rotate-file** para guardar los logs en archivos con rotación. Toda la configuración está en un único módulo, `src/utils/logger.js`, y el resto del proyecto lo importa sin repetir configuración:

```js
import logger from '../utils/logger.js';

logger.info('Pedido creado');
```

Los mensajes se muestran en la consola y se guardan en archivos con el formato `fecha [nivel] mensaje`:

```
2026-10-31 10:12:03 [info]    Servidor ShipNow escuchando en el puerto 8080 (entorno: development, nivel de log: debug)
2026-10-31 10:14:21 [warning] GET /api/orders/abc123 -> 404 ORDER_NOT_FOUND: Pedido no encontrado
2026-10-31 10:15:09 [error]   POST /api/mocks/seed?qty=5 -> 500 MOCK_SEED_FAILED: Falló la carga de datos de prueba en MongoDB {"details":[...]}
```

### Niveles de log

Un nivel activo registra ese nivel y todos los más graves. Las constantes están en `src/constants/constants.js` (`LOG_LEVELS`).

| Nivel | Prioridad | Para qué se usa en ShipNow |
| --- | --- | --- |
| `fatal` | 0 (más grave) | Fallas críticas: configuración inválida, falla de la conexión inicial a MongoDB, excepciones no capturadas |
| `error` | 1 | Errores inesperados del servidor (5xx), falla al cargar datos de prueba en MongoDB |
| `warning` | 2 | Errores esperados o del dominio (4xx): ruta inexistente, pedido no encontrado, cantidad inválida en mocks, entrega sin repartidor |
| `info` | 3 | Eventos importantes: servidor iniciado, conexión a MongoDB, pedido creado, usuario creado, carga de datos de prueba |
| `http` | 4 | Cada petición HTTP: método, ruta, status y duración |
| `debug` | 5 (más detallado) | Detalle para desarrollo: datos mock generados sin guardar |

### Qué se registra y dónde

| Evento | Nivel | Lugar |
| --- | --- | --- |
| Servidor iniciado y conexión a MongoDB establecida | `info` | `server.js` |
| Variables de entorno faltantes o fallo de la conexión inicial | `fatal` | `server.js` |
| MongoDB desconectado o error de conexión posterior | `warning` / `error` | `server.js` |
| Excepciones y promesas rechazadas sin manejar | `fatal` | `server.js` |
| Cada petición HTTP | `http` | `middlewares/requestLogger.js` |
| Errores de negocio (4xx), por ejemplo ruta o pedido inexistente, `qty` inválida | `warning` | `middlewares/errorHandler.js` |
| Errores inesperados del servidor (5xx) y falla del seed en MongoDB | `error` | `middlewares/errorHandler.js` |
| Problema grave de configuración (`CONFIG_ERROR`) | `fatal` | `middlewares/errorHandler.js` |
| Pedido, usuario o entrega creados, actualizados o eliminados | `info` | services |
| Entrega creada sin repartidor asignado | `warning` | `deliveries.service.js` |
| Generación de mocks sin guardar | `debug` | `mocks.service.js` |
| Carga de datos de prueba en MongoDB | `info` | `mocks.service.js` |

El logger no cambia la respuesta al cliente: el `errorHandler` registra el error y después responde con la misma estructura uniforme de siempre. Los logs no incluyen el cuerpo de las peticiones, para no guardar contraseñas.

### Cómo cambia según el entorno

El comportamiento se define con `NODE_ENV` y, opcionalmente, `LOG_LEVEL`:

| | `development` (por defecto) | `production` |
| --- | --- | --- |
| Nivel mínimo | `debug` (se registra todo) | `info` (se descartan `debug` y `http`) |
| Consola | Con colores por nivel | Texto plano |
| Archivos | `error` y `combined` | `error` y `combined` |

`LOG_LEVEL` fuerza otro nivel en cualquier entorno. Si tiene un valor inválido, se usa el nivel por defecto del entorno y se registra una advertencia.

Para probar el modo producción:

```powershell
# PowerShell
$env:NODE_ENV="production"; npm start
```

```bash
# Linux / macOS
NODE_ENV=production npm start
```

### Dónde se guardan los logs

Los archivos se crean automáticamente en la carpeta `logs/`:

| Archivo | Contenido |
| --- | --- |
| `logs/error-AAAA-MM-DD.log` | Solo los niveles `error` y `fatal` |
| `logs/combined-AAAA-MM-DD.log` | Todos los niveles que habilite el entorno (en development, desde `debug`) |

**Rotación:** se crea un archivo nuevo por día. Además, si un archivo supera los 10 MB se abre otro, los archivos anteriores se comprimen (`.gz`) y se conservan 14 días; los más viejos se eliminan solos.

**Git:** el `.gitignore` ignora todo el contenido de `logs/` (archivos `.log`, `.gz` y los auxiliares de la rotación). Solo se versiona `logs/.gitkeep`, para que la carpeta exista en el repositorio.

### Endpoint de prueba del logger

`GET /api/logger/test` genera un mensaje de cada nivel (`debug`, `http`, `info`, `warning`, `error` y `fatal`). Es una herramienta interna para verificar la configuración y no forma parte del negocio. Al no estar protegido, conviene quitarlo o restringirlo en un despliegue real.

```bash
curl "http://localhost:8080/api/logger/test"
```

```powershell
Invoke-RestMethod "http://localhost:8080/api/logger/test" | ConvertTo-Json -Depth 5
```

La respuesta indica el nivel activo y si cada mensaje quedó registrado (en producción, `debug` y `http` figuran como `registered: false`):

```json
{
  "status": "success",
  "payload": {
    "activeLevel": "debug",
    "levels": [
      { "level": "debug", "message": "[logger-test] Mensaje de prueba de nivel debug", "registered": true },
      { "level": "http", "message": "[logger-test] Mensaje de prueba de nivel http", "registered": true },
      { "level": "info", "message": "[logger-test] Mensaje de prueba de nivel info", "registered": true },
      { "level": "warning", "message": "[logger-test] Mensaje de prueba de nivel warning", "registered": true },
      { "level": "error", "message": "[logger-test] Mensaje de prueba de nivel error", "registered": true },
      { "level": "fatal", "message": "[logger-test] Mensaje de prueba de nivel fatal", "registered": true }
    ]
  }
}
```

En la consola del servidor se ven los seis mensajes:

```
2026-10-31 10:20:11 [debug]   [logger-test] Mensaje de prueba de nivel debug
2026-10-31 10:20:11 [http]    [logger-test] Mensaje de prueba de nivel http
2026-10-31 10:20:11 [info]    [logger-test] Mensaje de prueba de nivel info
2026-10-31 10:20:11 [warning] [logger-test] Mensaje de prueba de nivel warning
2026-10-31 10:20:11 [error]   [logger-test] Mensaje de prueba de nivel error
2026-10-31 10:20:11 [fatal]   [logger-test] Mensaje de prueba de nivel fatal
```

Para verificar que todo funciona:

1. Ejecutá el endpoint y mirá la consola: aparecen los mensajes según el nivel activo.
2. Abrí `logs/error-AAAA-MM-DD.log`: solo tiene las líneas `error` y `fatal`, sin `info` ni `debug`.
3. Abrí `logs/combined-AAAA-MM-DD.log`: tiene todos los niveles habilitados.
4. Provocá un caso inválido, por ejemplo `GET /api/mocks/users?qty=-5`: queda un `warning` con el código del error y el detalle.
5. Ejecutá `git status`: no debe aparecer nada de `logs/`.
