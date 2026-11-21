# ShipNow API

## 1. Descripción del proyecto

ShipNow es una API REST para gestionar envíos. Permite administrar **usuarios** (clientes, repartidores, tiendas y administradores), **pedidos** y **entregas**, y está organizada por capas para separar responsabilidades.

Registra lo que ocurre en el servidor con un **logger centralizado (Winston)**, con niveles, archivos de log y rotación (ver [8. Logging y monitoreo](#8-logging-y-monitoreo)).

Permite **subir documentos y comprobantes** (PDF e imágenes) con Multer: se guardan en carpetas del servidor y en la base se registran solo sus metadatos (ver [11. Carga de archivos](#11-carga-de-archivos-multer)).

La API está documentada con **Swagger / OpenAPI** y se puede consultar y probar desde el navegador en `/api/docs` (ver [9. Documentación de la API (Swagger)](#9-documentación-de-la-api-swagger)).

Tiene una **suite de tests funcionales** con Mocha, Chai y Supertest, con su propio entorno y su propia base de datos (ver [10. Testing funcional](#10-testing-funcional-mocha-chai-y-supertest)).

Incluye un **módulo de mocking** (`/api/mocks`) que genera datos simulados (usuarios, repartidores, pedidos y entregas) y permite cargarlos en MongoDB de forma controlada, sin tener que crearlos a mano. Los datos respetan los modelos reales, las relaciones entre entidades y las constantes del proyecto (roles, estados y prioridades).

## 2. Tecnologías utilizadas

| Tecnología | Uso |
| --- | --- |
| Node.js 18+ | Entorno de ejecución (módulos ES) |
| Express 4 | Servidor y ruteo |
| MongoDB + Mongoose 8 | Base de datos y modelado |
| dotenv | Variables de entorno |
| cors | Habilitar peticiones desde otros orígenes |
| multer | Recibe archivos (`multipart/form-data`) y los guarda en disco |
| winston | Logger centralizado con niveles de log |
| winston-daily-rotate-file | Archivos de log con rotación diaria |
| swagger-jsdoc | Arma la especificación OpenAPI a partir de los archivos `.yaml` de `src/docs/` |
| swagger-ui-express | Sirve Swagger UI (documentación interactiva) |
| nodemon | Reinicio automático en desarrollo |
| mocha | Organiza y ejecuta los tests (devDependency) |
| chai | Validaciones (`expect`) de los tests (devDependency) |
| supertest | Peticiones HTTP a la app Express sin abrir un puerto (devDependency) |
| cross-env | Define `NODE_ENV=test` igual en Windows, macOS y Linux (devDependency) |

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
│   ├── docs/                       # Documentación Swagger/OpenAPI (separada de las rutas)
│   │   ├── swagger.config.js       # Información general, servidor, tags y armado de la especificación
│   │   ├── schemas.yaml            # Schemas reutilizables (User, Order, Delivery, OrderItem, errores, etc.)
│   │   ├── components.yaml         # Parámetros y respuestas de error reutilizables
│   │   ├── users.yaml              # Endpoints de Users
│   │   ├── orders.yaml             # Endpoints de Orders
│   │   ├── deliveries.yaml         # Endpoints de Deliveries
│   │   ├── mocks.yaml              # Endpoints de Mocks
│   │   └── logger.yaml             # Endpoint de Logger
│   ├── models/                     # Esquemas de Mongoose (user, order, delivery) y file.schema.js (metadatos de archivos)
│   ├── repositories/               # Acceso a datos (users, orders, deliveries)
│   ├── services/                   # Lógica de negocio (users, orders, deliveries, mocks, logger)
│   ├── controllers/                # Reciben la request y responden (users, orders, deliveries, mocks, logger)
│   ├── routes/                     # Routers de Express (users, orders, deliveries, mocks, logger)
│   ├── middlewares/
│   │   ├── errorHandler.js         # Middleware global: único lugar que responde errores (y los registra en el log)
│   │   ├── requestLogger.js        # Registra cada petición HTTP (nivel http)
│   │   ├── routeNotFound.js        # Deriva las rutas inexistentes al errorHandler
│   │   └── upload.middleware.js    # Configuración centralizada de Multer (carpeta, nombre, tipos, tamaño y errores de carga)
│   └── utils/
│       ├── errors.js               # ErrorDictionary (diccionario de errores) y clase AppError
│       ├── fileStorage.js          # Manejo de archivos en disco (mover a su carpeta, borrar, crear la estructura)
│       ├── logger.js               # Configuración única de Winston (niveles, formato, consola, archivos y rotación)
│       └── mockData.js             # Datos base y helpers de azar para el mocking
├── tests/                          # Tests funcionales (Mocha + Chai + Supertest), un archivo por recurso
│   ├── setup.js                    # Hooks globales: verifica que sea la base de test, conecta y la borra al terminar
│   ├── helpers/index.js            # Datos de prueba controlados, limpieza y validación del formato de error
│   ├── app.test.js                 # /api/health y rutas inexistentes
│   ├── users.test.js               # /api/users
│   ├── orders.test.js              # /api/orders (incluye actualización de estados)
│   ├── deliveries.test.js          # /api/deliveries (incluye actualización de estados)
│   ├── mocks.test.js               # /api/mocks
│   ├── logger.test.js              # /api/logger/test
│   ├── uploads.test.js             # Carga de documentos de usuario y comprobantes de entrega
│   └── swagger.test.js             # /api/docs, /api/docs.json y coherencia con la documentación
├── logs/                           # Archivos de log generados por la app (se ignoran en Git, solo se versiona .gitkeep)
├── uploads/                        # Archivos subidos (se ignoran en Git; solo se versiona la estructura con .gitkeep)
│   ├── documents/                  # Documentos de usuario (DNI, etc.)
│   ├── licenses/                   # Licencias de conducir
│   └── proofs/                     # Comprobantes de entrega
├── .env.example                    # Ejemplo de variables de entorno de desarrollo
├── .env.test.example               # Ejemplo de variables de entorno de testing
├── .mocharc.json                   # Configuración de Mocha (dónde están los tests y el archivo de setup)
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
| `npm test` | Corre la suite de tests funcionales (ver [10. Testing funcional](#10-testing-funcional-mocha-chai-y-supertest)) |

### Probar rápidamente

1. Abrir la documentación interactiva: `http://localhost:8080/api/docs`
2. Cargar datos de prueba: `POST /api/mocks/seed?collection=all&qty=5`
3. Ver lo guardado: `GET /api/users`, `GET /api/orders`, `GET /api/deliveries`

## 5. Variables de entorno

Copiá `.env.example` a `.env` y completá los valores. El archivo `.env` no se sube al repositorio.

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `MONGODB_URI` | Sí | URI de conexión, por ejemplo `mongodb://localhost:27017/shipnow` |
| `JWT_SECRET` | Sí | Secreto de la aplicación |
| `PORT` | No | Puerto del servidor (por defecto `8080`) |
| `NODE_ENV` | No | `development`, `test` o `production` (por defecto `development`). `test` lo define `npm test` |
| `LOG_LEVEL` | No | Nivel mínimo de log: `fatal`, `error`, `warning`, `info`, `http` o `debug`. Si no se define: `debug` en `development` e `info` en `production` |
| `UPLOADS_DIR` | No | Carpeta donde se guardan los archivos subidos (por defecto `uploads`). En test siempre se usa `uploads/test` |

Si falta una variable obligatoria, la app no arranca: registra un log `fatal` indicando cuál falta y termina.

## 6. Endpoints

Las respuestas exitosas tienen la forma `{ "status": "success", "payload": ... }`. Los errores siempre tienen la misma estructura (ver [7. Manejo de errores](#7-manejo-de-errores)).

### General

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Estado del servidor |
| GET | `/api/docs` | Documentación interactiva (Swagger UI) |
| GET | `/api/docs.json` | Especificación OpenAPI en JSON (se puede importar en Postman) |
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

- **Usuarios:** el email es único, el rol debe ser uno de los válidos y no se puede crear un usuario con rol `admin` desde este endpoint. Los documentos (`documents`) no se envían en el body: se cargan con `POST /api/users/:id/documents`.
- **Pedidos:** el cliente debe existir y el pedido debe tener al menos un item válido (cantidad entera ≥ 1, precio ≥ 0). El estado y la prioridad deben ser valores permitidos. Se calculan `declaredValue`, `shippingCost` y `total`, y el pedido se crea en estado `created`.
- **Entregas:** el pedido debe existir y, si se indica un repartidor, debe existir y tener rol `driver`. El estado y la prioridad deben ser valores permitidos.

### Carga de archivos

Reciben `multipart/form-data` (no JSON). El detalle está en [11. Carga de archivos](#11-carga-de-archivos-multer).

| Método | Ruta | Campo del archivo | Descripción |
| --- | --- | --- | --- |
| POST | `/api/users/:id/documents` | `document` (+ `type` opcional) | Carga un documento del usuario (DNI, licencia de conducir) |
| POST | `/api/deliveries/:id/proofs` | `proof` | Carga un comprobante de entrega |

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
| `FILE_REQUIRED` | 400 | Archivos: no se envió ningún archivo |
| `INVALID_FILE_TYPE` | 400 | Archivos: el tipo de archivo no está permitido (solo PDF, JPG, PNG y WEBP) |
| `INVALID_FILE_SIZE` | 413 | Archivos: el archivo supera el tamaño máximo (5 MB) |
| `UNEXPECTED_FILE_FIELD` | 400 | Archivos: el archivo se envió en un campo que no corresponde |
| `INVALID_DOCUMENT_TYPE` | 400 | Archivos: el tipo de documento no es válido |
| `UPLOAD_ERROR` | 400 | Archivos: no se pudo procesar la carga (por ejemplo, multipart mal formado) |
| `FILE_SAVE_ERROR` | 500 | Archivos: error al guardar el archivo en el servidor |
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
| Documento cargado o comprobante asociado a una entrega | `info` | `users.service.js`, `deliveries.service.js` |
| Intento de subir un tipo de archivo no permitido, un archivo demasiado grande o en un campo inesperado | `warning` | `middlewares/upload.middleware.js` |
| No se pudo cargar o asociar un archivo (entidad inexistente, tipo de documento inválido, etc.) | `warning` | `users.service.js`, `deliveries.service.js` |
| No se pudo guardar el archivo en el servidor (`FILE_SAVE_ERROR`) | `error` | `utils/fileStorage.js` |
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

## 9. Documentación de la API (Swagger)

La API se documenta con **Swagger / OpenAPI 3** y se puede consultar y probar desde el navegador.

| Qué | Dónde |
| --- | --- |
| Documentación interactiva (Swagger UI) | `http://localhost:8080/api/docs` |
| Especificación en JSON | `http://localhost:8080/api/docs.json` |

El puerto es el de la variable `PORT` del `.env` (por defecto `8080`).

### Cómo levantar el servidor y abrir la documentación

```bash
npm install
cp .env.example .env      # en Windows PowerShell: Copy-Item .env.example .env
npm run dev
```

1. Verificá que MongoDB esté corriendo y que el `.env` tenga `MONGODB_URI` y `JWT_SECRET`.
2. Ejecutá `npm run dev` **desde la carpeta raíz del proyecto** (swagger-jsdoc busca los archivos `.yaml` con una ruta relativa).
3. Abrí `http://localhost:8080/api/docs` en el navegador.

### Módulos documentados

Los 24 endpoints están agrupados por tag:

| Tag | Endpoints documentados |
| --- | --- |
| **Users** | `GET /api/users`, `POST /api/users`, `GET /api/users/{id}`, `PUT /api/users/{id}`, `DELETE /api/users/{id}`, `POST /api/users/{id}/documents` (multipart/form-data) |
| **Orders** | `GET /api/orders`, `POST /api/orders`, `GET /api/orders/{id}`, `PUT /api/orders/{id}`, `DELETE /api/orders/{id}` |
| **Deliveries** | `GET /api/deliveries`, `POST /api/deliveries`, `GET /api/deliveries/{id}`, `PUT /api/deliveries/{id}`, `DELETE /api/deliveries/{id}`, `POST /api/deliveries/{id}/proofs` (multipart/form-data) |
| **Mocks** | `GET /api/mocks/users`, `/drivers`, `/orders`, `/deliveries`, `/dataset` y `POST /api/mocks/seed` |
| **Logger** | `GET /api/logger/test` (herramienta de validación del logger, no es una funcionalidad de negocio) |

Cada endpoint documenta: método y ruta, descripción, parámetros de ruta y de query, body esperado (cuando corresponde), respuesta exitosa y los errores que realmente puede devolver, con un ejemplo de cada código.

La información general (nombre, versión, descripción, propósito y servidor local) está en `src/docs/swagger.config.js`.

### Schemas reutilizables

Definidos en `src/docs/schemas.yaml` y referenciados desde los endpoints:

| Schema | Uso |
| --- | --- |
| `User`, `UserCreate`, `UserUpdate`, `UserSummary` | Usuario completo, body de alta, body de modificación y resumen que se muestra dentro de pedidos y entregas |
| `Order`, `OrderDetail`, `OrderCreate`, `OrderUpdate` | Pedido, pedido con cliente y entrega completados (lo que devuelven los GET), y los bodies de alta y modificación |
| `OrderItem` | Item de un pedido (`name`, `quantity`, `price`) |
| `Delivery`, `DeliveryDetail`, `DeliveryCreate`, `DeliveryUpdate` | Equivalentes para entregas |
| `SuccessResponse`, `SuccessMessage` | Respuesta exitosa con `payload` y respuesta exitosa con solo un `message` |
| `ErrorResponse` | Respuesta de error uniforme: `status`, `code`, `message` y `details` |
| `SeedSingleResult`, `SeedAllResult`, `MockDataset`, `LoggerTestResult` | Respuestas de mocks y logger |

Los enums (roles, estados de pedido y de entrega, prioridades, niveles de log y códigos de error) **se generan desde las mismas constantes que usa la API**, así que la documentación no se desactualiza si esas constantes cambian.

### Errores documentados

Los errores documentados son los mismos del [diccionario de errores](#7-manejo-de-errores) y siempre devuelven la estructura de `ErrorResponse`. Los más relevantes por módulo:

| Módulo | Errores |
| --- | --- |
| Users | `INVALID_ID`, `USER_NOT_FOUND`, `EMAIL_ALREADY_EXISTS`, `ADMIN_CREATION_FORBIDDEN`, `INVALID_USER_ROLE`, `VALIDATION_ERROR` |
| Orders | `ORDER_NOT_FOUND`, `CUSTOMER_NOT_FOUND`, `ORDER_WITHOUT_ITEMS`, `INVALID_ORDER_ITEMS`, `INVALID_ORDER_STATUS`, `INVALID_PRIORITY` |
| Deliveries | `DELIVERY_NOT_FOUND`, `ORDER_NOT_FOUND`, `DRIVER_NOT_FOUND`, `USER_NOT_DRIVER`, `INVALID_DELIVERY_STATUS`, `INVALID_PRIORITY` |
| Mocks | `QTY_NOT_INTEGER`, `QTY_NEGATIVE`, `QTY_OUT_OF_RANGE`, `INVALID_MOCK_COLLECTION`, `NO_CUSTOMERS_FOR_MOCK`, `NO_PENDING_ORDERS_FOR_MOCK`, `NO_DRIVERS_FOR_MOCK`, `MOCK_SEED_FAILED` |
| Todos | `INVALID_JSON`, `INTERNAL_SERVER_ERROR` |

### Cómo probar los endpoints desde Swagger UI

1. Abrí un endpoint y presioná **Try it out**, completá los datos y presioná **Execute**.
2. Para tener datos con los que trabajar, ejecutá primero `POST /api/mocks/seed` con `collection=all` y `qty=5`.
3. Ejecutá `GET /api/users` y `GET /api/orders` y copiá algún `_id`: los ids de los ejemplos de los bodies son de muestra y hay que reemplazarlos por ids reales.
4. Probá un alta, por ejemplo `POST /api/orders` con el `_id` de un usuario con rol `customer` en el campo `customer`.
5. Probá los casos inválidos para ver los errores documentados: `qty=-5` en cualquier endpoint de mocks, un `id` como `abc`, un pedido con `items: []` o un `status` inexistente.

### Aclaraciones

- **Autenticación:** la API no requiere autenticación, por eso Swagger UI no tiene botón *Authorize*.
- **Parámetros de mocks:** `qty` y `collection` figuran como texto (aunque `qty` es un número entre 1 y 100) para que Swagger UI deje enviar valores inválidos como `abc`, `-5` o `foo` y se pueda ver la respuesta de error real.
- **Seed sin body:** `POST /api/mocks/seed` no espera body. Sus parámetros (`collection` y `qty`) van por query.
- **Mocks con GET:** los endpoints `GET /api/mocks/...` devuelven datos simulados sin guardarlos en la base.
- **Logger:** `GET /api/logger/test` es una herramienta interna para validar el logger. Genera mensajes en todos los niveles y no forma parte de la lógica de negocio.
- **Contraseñas:** la API guarda y devuelve la contraseña tal cual (sin hash), y la documentación lo refleja en el schema `User`.
- **Mantenimiento:** si se agrega o cambia un endpoint, hay que actualizar el archivo `.yaml` correspondiente de `src/docs/`.

## 10. Testing funcional (Mocha, Chai y Supertest)

La suite prueba los endpoints de la API de punta a punta (router → controller → service → repository → MongoDB), tanto los casos exitosos como los errores esperados, comprobando el status HTTP, la estructura del body y el formato de error definido en el módulo de errores.

### Herramientas

| Herramienta | Para qué se usa |
| --- | --- |
| **Mocha** | Organiza (`describe`, `it`, hooks) y ejecuta los tests |
| **Chai** | Valida los resultados (`expect(...).to...`) |
| **Supertest** | Hace las peticiones HTTP directamente a la app de Express, sin levantar un servidor ni abrir un puerto |
| **cross-env** | Define `NODE_ENV=test` en el script `npm test` de forma igual en Windows, macOS y Linux |

Se instalan como `devDependencies`. Requieren **Node.js 20.19+ o 22.12+** (lo exige Mocha 12).

### Cómo ejecutar los tests

```bash
# 1. Instalar dependencias (incluye las de desarrollo)
npm install

# 2. Crear el archivo de variables de entorno de testing
cp .env.test.example .env.test      # en Windows PowerShell: Copy-Item .env.test.example .env.test

# 3. Tener MongoDB corriendo (ver "Base de datos de testing")

# 4. Correr la suite completa
npm test
```

Para correr un solo archivo: `npx cross-env NODE_ENV=test mocha tests/orders.test.js`.

> No corras `npx mocha` a secas: sin `NODE_ENV=test` los tests se niegan a arrancar (es a propósito, ver la protección más abajo). Usá siempre `npm test`.

### Base de datos de testing

**Sí, se requiere una base de datos de testing, separada de la de desarrollo.** Los tests crean y borran datos, así que nunca pueden usar la base `shipnow` de desarrollo.

- Por defecto se usa una MongoDB local con la base `shipnow-test` (`mongodb://localhost:27017/shipnow-test`). Una forma rápida de tenerla es con Docker: `docker run -d --rm --name mongo-test -p 27017:27017 mongo:7`.
- También sirve una base de Atlas, siempre que el nombre de la base en la URI contenga `test`.
- **Protección:** `tests/setup.js` aborta la suite si `NODE_ENV` no es `test` o si el nombre de la base en `MONGODB_URI` no contiene `test`. Así es imposible borrar por error la base de desarrollo.
- Al terminar la suite se elimina por completo la base de test (`dropDatabase`).

### Variables de entorno

Con `NODE_ENV=test`, `src/config/config.js` carga el archivo **`.env.test`** en lugar de `.env`. El archivo `.env.test` no se sube a Git; se versiona el ejemplo `.env.test.example`.

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `MONGODB_URI` | Sí | URI de la base de **test**. El nombre de la base debe contener `test`, por ejemplo `mongodb://localhost:27017/shipnow-test` |
| `JWT_SECRET` | Sí | Secreto de la aplicación. Sin él, crear pedidos responde `CONFIG_ERROR` |
| `NODE_ENV` | La define `npm test` | Debe ser `test` (lo configura el script con `cross-env`) |
| `PORT` | No | No hace falta: Supertest no abre ningún puerto |
| `LOG_LEVEL` | No | En test el logger queda en silencio y no escribe archivos en `logs/` |

### App separada del servidor

`src/app.js` arma Express y lo exporta, sin llamar a `listen`. `src/server.js` es el que conecta a MongoDB y abre el puerto. Gracias a esa separación, los tests hacen `import app from '../src/app.js'` y se lo pasan a Supertest; la conexión a la base de los tests la maneja `tests/setup.js`.

### Módulos cubiertos

| Archivo | Endpoints | Casos exitosos | Casos de error |
| --- | --- | --- | --- |
| `app.test.js` | `GET /api/health` y rutas inexistentes | Status `ok` y timestamp válido | `404 ROUTE_NOT_FOUND` (ruta inexistente, método no definido, recurso inexistente) |
| `users.test.js` | `GET/POST /api/users`, `GET/PUT/DELETE /api/users/:id` | Listado, alta, consulta por id, actualización y baja | `VALIDATION_ERROR`, `EMAIL_ALREADY_EXISTS`, `ADMIN_CREATION_FORBIDDEN`, `INVALID_USER_ROLE`, `DUPLICATE_KEY`, `USER_NOT_FOUND`, `INVALID_ID`, `INVALID_JSON` |
| `orders.test.js` | `GET/POST /api/orders`, `GET/PUT/DELETE /api/orders/:id` | Listado, alta con valores calculados, consulta por id, **actualización de cada estado**, baja | `ORDER_WITHOUT_ITEMS`, `INVALID_ORDER_ITEMS`, `VALIDATION_ERROR`, `INVALID_PRIORITY`, `CUSTOMER_NOT_FOUND`, `INVALID_ORDER_STATUS`, `ORDER_NOT_FOUND`, `INVALID_ID`, `INVALID_JSON` |
| `deliveries.test.js` | `GET/POST /api/deliveries`, `GET/PUT/DELETE /api/deliveries/:id` | Listado, alta, consulta por id, **actualización de cada estado**, baja | `ORDER_NOT_FOUND`, `DRIVER_NOT_FOUND`, `USER_NOT_DRIVER`, `INVALID_DELIVERY_STATUS`, `INVALID_PRIORITY`, `DELIVERY_NOT_FOUND`, `INVALID_ID`, `INVALID_JSON` |
| `mocks.test.js` | `GET /api/mocks/users`, `/drivers`, `/orders`, `/deliveries`, `/dataset` y `POST /api/mocks/seed` | Datos simulados válidos y coherentes, sin guardar en la base; seed de cada colección y de `all` | `QTY_NOT_INTEGER`, `QTY_NEGATIVE`, `QTY_OUT_OF_RANGE` (incluye `0`, `-5`, `abc`, `2.5` y `500`), `INVALID_MOCK_COLLECTION`, `NO_CUSTOMERS_FOR_MOCK`, `NO_PENDING_ORDERS_FOR_MOCK`, `NO_DRIVERS_FOR_MOCK` |
| `logger.test.js` | `GET /api/logger/test` | Un mensaje por nivel y `registered` coherente con el nivel activo | `404 ROUTE_NOT_FOUND` ante un método o ruta no definidos |
| `uploads.test.js` | `POST /api/users/:id/documents`, `POST /api/deliveries/:id/proofs` | Documento y comprobante cargados (archivo en disco + metadatos en la base), licencia de conducir, varios archivos, baja de la entidad con sus archivos | `FILE_REQUIRED`, `INVALID_DOCUMENT_TYPE`, `INVALID_FILE_TYPE`, `INVALID_FILE_SIZE`, `UNEXPECTED_FILE_FIELD`, `USER_NOT_DRIVER`, `USER_NOT_FOUND`, `DELIVERY_NOT_FOUND`, `INVALID_ID` (y que no quede ningún archivo huérfano en el disco) |
| `swagger.test.js` | `GET /api/docs/`, `GET /api/docs.json` | Swagger UI en HTML y especificación OpenAPI con los 24 endpoints | `404 ROUTE_NOT_FOUND` ante un método no definido, y coherencia documentación ↔ comportamiento real |

No se testean los `500` documentados (`INTERNAL_SERVER_ERROR` y `MOCK_SEED_FAILED`, la falla de MongoDB durante el seed) porque exigirían romper la conexión a la base en pleno test.

### Qué valida cada test

Ningún test se queda en "responde": todos comprueban **status HTTP + estructura del body**.

- **Éxito:** `{ status: 'success', payload }` o `{ status: 'success', message }`, con las propiedades importantes del recurso (por ejemplo, en un pedido: `customer`, `items`, `declaredValue`, `shippingCost`, `total`, `status`, `priority`) y, cuando corresponde, que el dato **quedó guardado en la base**.
- **Error:** el helper `expectApiError` (en `tests/helpers/index.js`) verifica el status esperado, que el body tenga exactamente `status`, `code`, `message` y `details`, y que `code` y `message` sean los del `ErrorDictionary` de `src/utils/errors.js`. Además, cada test revisa los `details` que corresponden (campo, valor recibido, valores permitidos).

### Datos de prueba y limpieza

- **Datos controlados y repetibles:** los tests crean sus propios datos con las funciones de `tests/helpers/index.js` (`createUser`, `createDriver`, `createOrder`, `createDelivery`). Por ejemplo, para probar un pedido primero se crea un cliente válido. Los montos son fijos (2 × 9000 + 1 × 4000 = 22000) y los emails son únicos y del dominio `shipnow-test.com`. Nunca se usan datos reales ni cargados a mano.
- **Limpieza antes de cada test:** cada archivo tiene un `beforeEach(clearDatabase)` que vacía `users`, `orders` y `deliveries`. Cada test arranca desde cero, por eso **no dependen del estado previo de la base ni del orden de ejecución**.
- **Limpieza final:** el hook global `afterAll` de `tests/setup.js` elimina la base de test completa y cierra la conexión.
- Los tests de la API **sí escriben** en la base de test, pero nunca en la de desarrollo. La suite se puede correr varias veces seguidas sin borrar nada a mano.

### Coherencia con Swagger

Todo lo que se documentó en el Módulo 5 tiene su test: los 24 endpoints, con su respuesta exitosa y sus errores `4xx`, están cubiertos en los archivos por recurso. Además, `swagger.test.js` toma los **ejemplos de error de la especificación** (`/api/docs.json`), hace la petición real y compara que la respuesta sea idéntica. Si la documentación y el comportamiento se separan, el test falla.

### Logger en test

Con `NODE_ENV=test` el logger (`src/utils/logger.js`) queda en silencio y no crea archivos en `logs/`: la salida de Mocha queda limpia y los tests no ensucian los logs de desarrollo.

## 11. Carga de archivos (Multer)

La API recibe documentos y comprobantes con **Multer** (`multipart/form-data`), los valida, los guarda en carpetas del servidor y registra **solo sus metadatos** en MongoDB. Cada archivo queda asociado a una entidad: un usuario (`documents`) o una entrega (`proofs`).

### Endpoints

| Método | Ruta | Campo del archivo | Campos adicionales | Descripción |
| --- | --- | --- | --- | --- |
| POST | `/api/users/:id/documents` | `document` (obligatorio) | `type` (opcional): `user_document` (por defecto) o `driver_license` | Carga un documento del usuario. La licencia solo la puede cargar un usuario con rol `driver` |
| POST | `/api/deliveries/:id/proofs` | `proof` (obligatorio) | — | Carga un comprobante de entrega (tipo `delivery_proof`) |

Reglas comunes: un solo archivo por petición, tipos aceptados **PDF, JPG, PNG y WEBP**, tamaño máximo **5 MB**. Ambos responden `201` con la entidad actualizada.

### Cómo probarlos

Desde Swagger UI (`/api/docs`), en *Try it out* aparece el selector de archivo. Con `curl` (en PowerShell usá `curl.exe`):

```bash
# documento de usuario (el campo "type" es opcional)
curl.exe -X POST http://localhost:8080/api/users/<ID_USUARIO>/documents \
  -F "type=user_document" -F "document=@dni.pdf;type=application/pdf"

# comprobante de una entrega
curl.exe -X POST http://localhost:8080/api/deliveries/<ID_ENTREGA>/proofs \
  -F "proof=@comprobante.jpg;type=image/jpeg"
```

En Postman: *Body → form-data*, con la clave `document` (o `proof`) de tipo **File**.

Respuesta exitosa (`201`) de un documento de usuario:

```json
{
  "status": "success",
  "message": "Documento cargado correctamente",
  "payload": {
    "_id": "671a2b3c4d5e6f7890123456",
    "firstName": "Ana",
    "documents": [
      {
        "originalName": "dni.pdf",
        "fileName": "1763500000000-7f3c9d1e-2b4a-4c6e-9a1f-0d8e5b7c3a21.pdf",
        "path": "uploads/documents/1763500000000-7f3c9d1e-2b4a-4c6e-9a1f-0d8e5b7c3a21.pdf",
        "mimeType": "application/pdf",
        "size": 1022223,
        "type": "user_document",
        "uploadedAt": "2026-11-19T15:30:00.000Z"
      }
    ]
  }
}
```

### Configuración de Multer

Está **centralizada** en `src/middlewares/upload.middleware.js`; los routers solo importan `uploadUserDocument` y `uploadDeliveryProof`. Los valores salen de `src/constants/constants.js`.

| Qué define | Cómo |
| --- | --- |
| Dónde se guardan | `diskStorage`: el archivo llega a `uploads/tmp` y, una vez validado todo, se mueve a la carpeta de su tipo (ver abajo) |
| Cómo se nombran | `<timestamp>-<uuid><extensión>`, único. La extensión sale del tipo ya validado, no del nombre que mandó el cliente. El nombre original se guarda en los metadatos |
| Tipos aceptados | `ALLOWED_MIME_TYPES`: `application/pdf`, `image/jpeg`, `image/png`, `image/webp` |
| Tamaño máximo | `UPLOAD_LIMITS.MAX_FILE_SIZE`: 5 MB |
| Manejo de errores | Los errores de Multer se convierten en errores del diccionario y pasan por el `errorHandler` global (mismo formato que el resto de la API) |

El archivo pasa primero por `uploads/tmp` porque el tipo de documento llega como un campo de texto del mismo formulario y recién se conoce con certeza cuando Multer terminó de leer el request. Si algo falla después (usuario inexistente, tipo inválido, etc.), el archivo se borra: **no quedan archivos huérfanos**.

### Carpetas de uploads

```
uploads/
├── tmp/         # paso intermedio (se crea sola)
├── documents/   # user_document: documentos de usuario
├── licenses/    # driver_license: licencias de conducir
└── proofs/      # delivery_proof: comprobantes de entrega
```

La estructura se crea al iniciar el servidor (y cada carpeta se crea sola si falta). En `.gitignore` está todo el contenido de `uploads/`, así los archivos subidos **no van al repositorio**; solo se versionan los `.gitkeep` que mantienen las carpetas. En test los archivos se guardan en `uploads/test` y se borran al terminar. Los archivos de una entidad se eliminan del disco cuando se elimina la entidad.

### Qué se guarda en la base

Solo metadatos (esquema `src/models/file.schema.js`): `originalName`, `fileName`, `path`, `mimeType`, `size`, `type` (tipo de documento) y `uploadedAt`. Nunca el contenido del archivo.

### Validaciones y errores

Todos responden con el formato general (`{ status: "error", code, message, details }`):

| Validación | Código | HTTP |
| --- | --- | --- |
| Que se envíe un archivo | `FILE_REQUIRED` | 400 |
| Que el tipo de archivo sea permitido | `INVALID_FILE_TYPE` | 400 |
| Que no supere el tamaño máximo | `INVALID_FILE_SIZE` | 413 |
| Que el archivo llegue en el campo esperado (`document` / `proof`) | `UNEXPECTED_FILE_FIELD` | 400 |
| Que el tipo de documento sea válido (si se envía) | `INVALID_DOCUMENT_TYPE` | 400 |
| Que el usuario exista | `USER_NOT_FOUND` | 404 |
| Que la entrega exista | `DELIVERY_NOT_FOUND` | 404 |
| Que la licencia la cargue un repartidor | `USER_NOT_DRIVER` | 400 |
| Que el id tenga formato válido | `INVALID_ID` | 400 |
| Que el multipart esté bien formado | `UPLOAD_ERROR` | 400 |
| Que el archivo se pueda guardar en el servidor | `FILE_SAVE_ERROR` | 500 |

### Logging

Se registran: la carga exitosa y el comprobante asociado a una entrega (`info`), el intento de subir un tipo de archivo no permitido, uno demasiado grande o en un campo inesperado (`warning`), los errores al cargar o asociar un archivo (`warning`) y los fallos al guardar en disco (`error`). Ver la tabla de [8. Logging y monitoreo](#8-logging-y-monitoreo).

### Tests

`tests/uploads.test.js` cubre la carga correcta de un documento y de un comprobante (archivo en disco y metadatos en la base), la licencia de conducir, el error cuando falta el archivo, el tipo de documento inválido, el tipo de archivo no permitido, el tamaño excedido, el campo inesperado y la entidad inexistente. Los archivos de prueba se crean en memoria y se guardan en `uploads/test`. `swagger.test.js` compara los errores documentados de estos endpoints con los reales.
