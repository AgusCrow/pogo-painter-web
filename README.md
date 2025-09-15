# 🎮 Pogo Painter Web

<div align="center">

![Pogo Painter Logo](https://img.shields.io/badge/Pogo-Painter-FF6B6B?style=for-the-badge&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

**Versión web del clásico minijuego de Crash Bash con multiplayer en tiempo real**

[📖 Documentación](#documentación) • [🚀 Cómo Empezar](#cómo-empezar) • [🎮 Cómo Jugar](#cómo-jugar) • [🛠️ Tecnologías](#tecnologías)

</div>

---

## 📋 Sobre el Proyecto

Pogo Painter Web es una implementación completa y moderna del clásico minijuego de Crash Bash. Los jugadores compiten en tiempo real por pintar la mayor cantidad de baldosas en un tablero interactivo, usando sus pogos para saltar y dejar un rastro de color.

### ✨ Características Principales

- 🎯 **Multijugador en Tiempo Real**: Juega con amigos usando WebSockets
- 🔐 **Sistema de Autenticación**: Registro y login de usuarios seguro
- 🎨 **Tablero Interactivo**: Grid 10x10 con baldosas pintables
- ⚡ **Movimiento Fluido**: Sistema de saltos y pintado intuitivo
- 💥 **Mecánicas de Combate**: Aturde a tus oponentes saltando sobre ellos
- 🏆 **Puntuación en Vivo**: Tabla de clasificación actualizada en tiempo real
- 🎁 **Power-ups**: Recoge power-ups para obtener ventajas estratégicas
- ⏱️ **Temporizador**: Partidas con límite de tiempo configurable
- 📱 **Responsive Design**: Juega desde cualquier dispositivo
- 🎨 **UI Moderna**: Interfaz elegante usando shadcn/ui

---

## 🚀 Cómo Empezar

### Prerrequisitos

Asegúrate de tener instalado:
- Node.js 18+ 
- npm o yarn

### Instalación

1. **Clona el repositorio**
   ```bash
   git clone https://github.com/AgusCrow/pogo-painter-web.git
   cd pogo-painter-web
   ```

2. **Instala las dependencias**
   ```bash
   npm install
   ```

3. **Configura las variables de entorno**
   ```bash
   cp .env.example .env
   ```
   Edita el archivo `.env` con tu configuración:
   ```env
   DATABASE_URL="file:./dev.db"
   NODE_ENV="development"
   ```

4. **Inicializa la base de datos**
   ```bash
   npm run db:push
   ```

5. **Inicia el servidor de desarrollo**
   ```bash
   npm run dev
   ```

6. **Abre tu navegador**
   ```
   http://localhost:3000
   ```

---

## 🎮 Cómo Jugar

### Objetivo del Juego
Pinta la mayor cantidad de baldosas con tu color antes de que se acabe el tiempo.

### Controles
- **Movimiento**: Haz clic en las baldosas adyacentes (incluyendo diagonales)
- **Pintado**: Cada movimiento automáicamente pinta la baldosa de tu color
- **Ataque**: Salta sobre tus oponentes para aturdirlos temporalmente

### Reglas
1. Solo puedes moverte a baldosas adyacentes
2. Cada baldosa pintada te da 1 punto
3. Si pintas una baldosa de un oponente, también obtienes 1 punto
4. Los jugadores aturdidos no pueden moverse por 3 segundos
5. El jugador con más puntos al finalizar gana

### Power-ups
- ⚡ **SPEED**: Aumenta tu velocidad de movimiento
- 🦘 **JUMP**: Permite saltar a baldosas más lejanas
- 🎨 **SPRAY**: Pinta múltiples baldosas a la vez

---

## 🛠️ Tecnologías Utilizadas

### Frontend
- **[Next.js 15](https://nextjs.org/)** - Framework React con App Router
- **[TypeScript](https://www.typescriptlang.org/)** - Tipado fuerte y seguro
- **[Tailwind CSS](https://tailwindcss.com/)** - Framework de CSS utility-first
- **[shadcn/ui](https://ui.shadcn.com/)** - Componentes UI modernos
- **[Lucide React](https://lucide.dev/)** - Iconos hermosos

### Backend
- **[Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)** - Backend serverless
- **[Prisma ORM](https://www.prisma.io/)** - ORM moderno y type-safe
- **[SQLite](https://www.sqlite.org/)** - Base de datos ligera

### Comunicación en Tiempo Real
- **[Socket.IO](https://socket.io/)** - WebSockets para multiplayer
- **[bcryptjs](https://www.npmjs.com/package/bcryptjs)** - Hashing de contraseñas

### Desarrollo
- **[ESLint](https://eslint.org/)** - Linting de código
- **[Prettier](https://prettier.io/)** - Formateo de código

---

## 📁 Estructura del Proyecto

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # Autenticación
│   │   ├── games/                # Gestión de juegos
│   │   └── health/               # Health check
│   ├── layout.tsx                # Layout principal
│   ├── page.tsx                  # Página principal
│   └── globals.css               # Estilos globales
├── components/                   # Componentes React
│   ├── ui/                       # shadcn/ui components
│   ├── auth-form.tsx            # Formulario de auth
│   ├── game-board.tsx           # Tablero principal
│   ├── game-grid.tsx            # Grid interactivo
│   └── score-board.tsx          # Tabla de puntuaciones
├── hooks/                       # Custom hooks
│   ├── use-game-socket.ts       # Hook WebSocket
│   └── use-toast.ts             # Hook notificaciones
├── lib/                         # Utilidades
│   ├── db.ts                    # Cliente Prisma
│   ├── socket.ts                # Config Socket.IO
│   └── utils.ts                 # Utilidades varias
└── types/                       # Tipos TypeScript
    └── game.ts                  # Tipos del juego
```

---

## 🔧 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar nuevo usuario
- `POST /api/auth/login` - Iniciar sesión

### Gestión de Juegos
- `GET /api/games` - Listar partidas disponibles
- `POST /api/games` - Crear nueva partida
- `POST /api/games/[id]/join` - Unirse a partida
- `POST /api/games/[id]/start` - Iniciar partida
- `POST /api/games/[id]/move` - Realizar movimiento
- `GET /api/games/[id]/tiles` - Obtener baldosas

### WebSocket Events
- `join-game` - Unirse a sala de juego
- `player-move` - Realizar movimiento
- `start-game` - Iniciar partida
- `game-state` - Recibir estado del juego
- `player-moved` - Movimiento de otro jugador

---

## 🎯 Roadmap

### ✅ Versión 1.0 - Completado
- [x] Sistema de autenticación
- [x] Gestión de partidas multijugador
- [x] Tablero interactivo 10x10
- [x] Movimiento y pintado de baldosas
- [x] Sistema de colisiones y aturdimiento
- [x] Puntuación en tiempo real
- [x] Comunicación vía WebSockets
- [x] UI responsive y moderna

### 🚧 Versión 1.1 - En Desarrollo
- [ ] Power-ups funcionales (SPEED, JUMP, SPRAY)
- [ ] IA para oponentes
- [ ] Efectos de sonido
- [ ] Animaciones mejoradas

### 🔮 Versión 2.0 - Futuro
- [ ] Sistema de torneos
- [ ] Historial de partidas
- [ ] Perfiles de usuario con estadísticas
- [ ] Chat en juego
- [ ] Modos de juego adicionales (Team, Survival)
- [ ] Sistema de rankings global

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Si quieres mejorar el proyecto, sigue estos pasos:

1. **Haz Fork del proyecto**
   ```bash
   git clone https://github.com/TU_USUARIO/pogo-painter-web.git
   ```

2. **Crea tu rama de características**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Commitea tus cambios**
   ```bash
   git commit -m 'Add amazing feature'
   ```

4. **Push a la rama**
   ```bash
   git push origin feature/amazing-feature
   ```

5. **Abre un Pull Request**

### Guía de Estilo
- Usa TypeScript para todo el código
- Sigue las convenciones de ESLint
- Documenta tus funciones y componentes
- Haz pruebas para nuevas funcionalidades

---

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT - ve el archivo [LICENSE](LICENSE) para detalles.

---

## 🙏 Agradecimientos

- **[Crash Bash](https://es.wikipedia.org/wiki/Crash_Bash)** - Por el juego original que inspiró este proyecto
- **[Next.js](https://nextjs.org/)** - Por el increíble framework
- **[shadcn/ui](https://ui.shadcn.com/)** - Por los hermosos componentes
- **[Tailwind CSS](https://tailwindcss.com/)** - Por el framework CSS amazing

---

## 📞 Contacto

**Agus Crow** - [@aguscrow](https://github.com/AgusCrow)

**Enlace del Proyecto**: [https://github.com/AgusCrow/pogo-painter-web](https://github.com/AgusCrow/pogo-painter-web)

---

<div align="center">

⭐ Si este proyecto te gustó, dale una estrella!

![Star History](https://img.shields.io/github/stars/AgusCrow/pogo-painter-web?style=social)

</div>