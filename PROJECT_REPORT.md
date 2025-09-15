# Pogo Painter Web - Reporte Completo del Proyecto

## Resumen del Proyecto

Pogo Painter Web es una implementación en tiempo real del clásico minijuego de Crash Bash, desarrollado con Next.js 15, TypeScript, Prisma, y WebSockets. El juego permite a múltiples jugadores competir por pintar la mayor cantidad de baldosas en un tablero cuadrado, con mecánicas de movimiento, ataques, power-ups y un sistema de puntuación en tiempo real.

## Arquitectura General

### Tecnologías Principales

- **Frontend**: Next.js 15 con App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma ORM con SQLite
- **Comunicación en Tiempo Real**: Socket.IO con WebSockets
- **Base de Datos**: SQLite con Prisma ORM
- **Autenticación**: Sistema propio con bcryptjs para hashing de contraseñas
- **UI/UX**: shadcn/ui components con diseño responsive

### Estructura del Proyecto

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # Autenticación
│   │   │   ├── login/route.ts    # Login de usuarios
│   │   │   └── register/route.ts # Registro de usuarios
│   │   ├── games/                # Gestión de juegos
│   │   │   ├── route.ts          # CRUD de juegos
│   │   │   └── [id]/
│   │   │       ├── join/route.ts  # Unirse a juego
│   │   │       ├── move/route.ts  # Movimientos de jugadores
│   │   │       ├── start/route.ts # Iniciar juego
│   │   │       └── tiles/route.ts # Obtener baldosas
│   │   └── health/route.ts       # Health check
│   ├── layout.tsx                # Layout principal
│   ├── page.tsx                  # Página principal
│   └── globals.css               # Estilos globales
├── components/                   # Componentes React
│   ├── ui/                       # shadcn/ui components
│   ├── auth-form.tsx            # Formulario de autenticación
│   ├── game-board.tsx           # Tablero principal del juego
│   ├── game-grid.tsx            # Grid de baldosas interactivo
│   └── score-board.tsx          # Tabla de puntuaciones
├── hooks/                        # Custom React hooks
│   use-game-socket.ts           # Hook para WebSocket
│   use-mobile.ts                # Hook para detección móvil
│   └── use-toast.ts             # Hook para notificaciones
├── lib/                         # Librerías y utilidades
│   db.ts                        # Cliente Prisma
│   socket.ts                    # Configuración Socket.IO
│   └── utils.ts                 # Utilidades varias
└── types/                       # Definiciones TypeScript
    └── game.ts                  # Tipos del juego
```

## Base de Datos - Esquema Prisma

### Modelos Principales

#### User
- **Propósito**: Almacenar información de usuarios
- **Campos**: id, email, name, password, createdAt, updatedAt
- **Relaciones**: Uno a muchos con Player

#### Game
- **Propósito**: Representar cada partida del juego
- **Campos**: 
  - id, name, status (WAITING, PLAYING, FINISHED)
  - maxPlayers, timeLimit, boardSize
  - createdAt, updatedAt
- **Relaciones**: Uno a muchos con Player y GameTile

#### Player
- **Propósito**: Representar a cada jugador en una partida
- **Campos**:
  - id, userId, gameId, color
  - positionX, positionY, score
  - status (ACTIVE, STUNNED, ELIMINATED), isAI
  - createdAt, updatedAt
- **Relaciones**: Pertenece a User y Game

#### GameTile
- **Propósito**: Representar cada baldosa del tablero
- **Campos**:
  - id, gameId, x, y
  - color (jugador que la pintó)
  - hasPowerUp, powerUpType (SPEED, JUMP, SPRAY)
  - createdAt, updatedAt
- **Relaciones**: Pertenece a Game

### Enumeraciones

- **GameStatus**: WAITING, PLAYING, FINISHED
- **PlayerStatus**: ACTIVE, STUNNED, ELIMINATED

## Flujo de la Aplicación

### 1. Autenticación de Usuarios

**Flujo**:
1. Usuario ingresa email y contraseña
2. Frontend envía petición a `/api/auth/login` o `/api/auth/register`
3. Backend valida credenciales y hashea/verifica contraseña con bcryptjs
4. Si es válido, retorna datos del usuario (sin contraseña)
5. Frontend almacena estado de autenticación localmente

**Endpoints**:
- `POST /api/auth/register` - Crear nuevo usuario
- `POST /api/auth/login` - Iniciar sesión

### 2. Gestión de Partidas

**Flujo**:
1. Usuario autenticado ve lista de partidas disponibles
2. Puede crear nueva partida o unirse a existente
3. Al crear partida: se genera en BD con estado WAITING
4. Al unirse: se crea Player con color aleatorio y posición inicial
5. Se inicializan las baldosas del tablero con power-ups aleatorios

**Endpoints**:
- `GET /api/games` - Obtener todas las partidas
- `POST /api/games` - Crear nueva partida
- `POST /api/games/[id]/join` - Unirse a partida
- `POST /api/games/[id]/start` - Iniciar partida
- `GET /api/games/[id]/tiles` - Obtener baldosas

### 3. Lógica del Juego

#### Sistema de Movimiento
- **Validación**: Solo se permite mover a baldosas adyacentes (incluyendo diagonales)
- **Pintado**: Al moverse, la baldosa se pinta del color del jugador
- **Colisiones**: Si un jugador cae sobre otro, el oponente queda aturdido por 3 segundos
- **Puntuación**: +1 punto por pintar baldosa nueva o repintar de oponente

#### Power-ups
- **SPEED**: Aumenta velocidad de movimiento (no implementado)
- **JUMP**: Permite saltar más lejos (no implementado)
- **SPRAY**: Permite pintar múltiples baldosas (no implementado)

#### Estados del Jugador
- **ACTIVE**: Puede moverse y jugar normalmente
- **STUNNED**: No puede moverse (animación de pulso)
- **ELIMINATED**: Fuera del juego (no implementado)

### 4. Comunicación en Tiempo Real (WebSockets)

#### Eventos de Socket.IO

**Cliente → Servidor**:
- `join-game` - Unirse a sala de juego
- `player-move` - Realizar movimiento
- `start-game` - Iniciar partida
- `request-game-state` - Solicitar estado actual

**Servidor → Cliente**:
- `game-state` - Estado completo del juego
- `game-started` - Notificación de inicio
- `player-moved` - Movimiento de otro jugador
- `player-joined` - Nuevo jugador se unió
- `player-left` - Jugador abandonó
- `error` - Mensajes de error

#### Salas (Rooms)
- Cada partida tiene su propia sala: `game-{gameId}`
- Los eventos se transmiten solo a jugadores en la misma sala
- Permite múltiples partidas simultáneas sin interferencia

## Componentes Principales

### AuthForm
- **Propósito**: Manejar registro y login
- **Características**:
  - Tabs para cambiar entre login/register
  - Validación de formulario
  - Manejo de estados de carga
  - Notificaciones con Sonner

### GameBoard
- **Propósito**: Componente principal del juego
- **Características**:
  - Gestión de estado de partidas y jugadores
  - Integración con API REST y WebSockets
  - Renderizado condicional (lista de partidas vs juego activo)
  - Manejo de acciones del usuario

### GameGrid
- **Propósito**: Renderizar el tablero de juego interactivo
- **Características**:
  - Grid responsive de baldosas
  - Indicadores visuales de jugadores y power-ups
  - Validación visual de movimientos válidos
  - Actualización en tiempo real
  - Coordenadas para debugging

### ScoreBoard
- **Propósito**: Mostrar puntuaciones y estado del juego
- **Características**:
  - Ranking en tiempo real
  - Temporizador de partida
  - Indicadores de estado (stunned, etc.)
  - Resumen al finalizar partida

## Hooks Personalizados

### useGameSocket
- **Propósito**: Manejar conexión y eventos WebSocket
- **Características**:
  - Gestión automática de conexión/desconexión
  - Tipado fuerte para eventos
  - Manejo de errores
  - Abstracción de lógica de WebSocket

## Patrones de Diseño y Buenas Prácticas

### 1. Arquitectura en Capas
- **Presentación**: Componentes React con hooks
- **Lógica**: API Routes y servicios
- **Datos**: Prisma ORM con SQLite

### 2. Tipado Fuerte
- TypeScript en todo el proyecto
- Interfaces bien definidas para tipos de juego
- Validación de datos en tiempo de compilación

### 3. Manejo de Estado
- **Estado Local**: useState para componentes individuales
- **Estado Global**: Context API no necesario (estado gestionado por BD)
- **Estado en Tiempo Real**: WebSockets para sincronización

### 4. Manejo de Errores
- Try-catch en todas las operaciones asíncronas
- Mensajes de error descriptivos
- Estados de carga para mejor UX

### 5. Seguridad
- Hashing de contraseñas con bcryptjs
- Validación de entradas del usuario
- No exposición de datos sensibles

## Flujo de Datos Completo

### 1. Inicio de Sesión
```
Usuario → AuthForm → API Auth → BD (User) → Respuesta → Estado Local
```

### 2. Creación de Partida
```
Usuario → GameBoard → API Games → BD (Game) → Actualizar Lista
```

### 3. Unión a Partida
```
Usuario → GameBoard → API Join → BD (Player, Tiles) → WebSocket Join Game
```

### 4. Movimiento de Jugador
```
Click Tile → GameGrid → GameBoard → API Move → BD (Player, Tile) → WebSocket Broadcast → Actualizar Todos
```

### 5. Sincronización en Tiempo Real
```
Cualquier Acción → WebSocket → Todos los Clientes → Actualizar UI
```

## Características Implementadas vs. Planeadas

### ✅ Completado
- Sistema de autenticación completo
- Gestión de partidas (crear, unir, listar)
- Tablero de juego interactivo 10x10
- Sistema de movimiento y pintado
- Colisiones y aturdimiento
- Puntuación en tiempo real
- WebSockets para multijugador
- Temporizador de partidas
- UI responsive y moderna
- Power-ups básicos (visuales)

### 🚧 Planeado/Incompleto
- Power-ups funcionales (SPEED, JUMP, SPRAY)
- IA para oponentes
- Sistema de torneos
- Historial de partidas
- Perfiles de usuario
- Chat en juego
- Sonidos y efectos visuales mejorados
- Animaciones más fluidas
- Sistema de rankings global

## Cómo Extender el Proyecto

### 1. Añadir Nuevos Power-ups
```typescript
// 1. Actualizar esquema Prisma
model GameTile {
  // ... campos existentes
  powerUpType String? // Añadir nuevos tipos
}

// 2. Implementar lógica en move/route.ts
if (tile.hasPowerUp) {
  switch (tile.powerUpType) {
    case 'SPEED':
      // Implementar velocidad aumentada
      break;
    case 'JUMP':
      // Implementar salto extendido
      break;
  }
}
```

### 2. Añadir IA
```typescript
// Crear servicio de IA
export class GameAI {
  static makeMove(game: Game, player: Player): { x: number, y: number } {
    // Lógica para decidir mejor movimiento
    // - Evitar jugadores
    // - Buscar power-ups
    // - Pintar baldosas estratégicas
  }
}
```

### 3. Añadir Nuevos Modos de Juego
```typescript
// Actualizar modelo Game
model Game {
  // ... campos existentes
  gameMode GameMode @default(CLASSIC)
}

enum GameMode {
  CLASSIC
  TEAM
  SURVIVAL
  KING_OF_THE_HILL
}
```

### 4. Mejorar Rendimiento
- Implementar React.memo para componentes
- Usar useCallback para funciones en componentes
- Optimizar consultas Prisma con select
- Implementar paginación para listas grandes

## Consideraciones de Despliegue

### Variables de Entorno Necesarias
```env
DATABASE_URL="file:./dev.db"  # Para desarrollo
NEXTAUTH_SECRET="your-secret-key" # Para producción
NODE_ENV="production"
```

### Requisitos de Producción
- Base de datos más robusta (PostgreSQL)
- Redis para caché y sesiones
- Balanceador de carga para múltiples instancias
- Socket.IO adapter para multi-server
- CDN para assets estáticos

## Testing y Calidad

### Estrategias de Testing
- **Unit Tests**: Componentes React, hooks, utilidades
- **Integration Tests**: API Routes, lógica de juego
- **E2E Tests**: Flujo completo del juego
- **Load Testing**: Múltiples jugadores simultáneos

### Herramientas Recomendadas
- Jest + React Testing Library
- Playwright para E2E
- Artillery para load testing
- MSW para mocking de API

## Conclusión

Pogo Painter Web es una implementación sólida y escalable del juego clásico, utilizando tecnologías modernas y buenas prácticas de desarrollo. La arquitectura basada en eventos con WebSockets permite una experiencia multijugador fluida, mientras que la separación clara entre frontend, backend y base de datos facilita el mantenimiento y extensión del proyecto.

El proyecto está listo para ser desplegado y puede extenderse fácilmente con nuevas características siguiendo los patrones establecidos. La base técnica sólida permite añadir funcionalidades complejas como IA, nuevos modos de juego, y sistemas de torneos sin comprometer la estabilidad del sistema.