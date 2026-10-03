# Implementación de Seguridad y Enrutamiento Protegido

Este documento detalla la implementación de seguridad a nivel de rutas, autenticación global y protección por roles realizada en el proyecto PWA de Peluquería & Estética.

## 1. Contexto Global de Autenticación (`AuthContext.tsx`)
Se creó un proveedor de estado global que se encarga de:
- Inicializar la sesión de Supabase Auth al abrir la app.
- Escuchar los cambios de sesión en tiempo real (login, logout, token refresh).
- Cargar automáticamente el perfil del usuario desde la tabla `usuarios` (para obtener el nombre, apellido y, lo más importante, el **rol**).
- Exponer un método centralizado para hacer *logout* de forma segura.

## 2. Route Guards (Protectores de Rutas)
Se implementaron tres componentes clave para proteger las rutas:

- **`ProtectedRoute.tsx`**: Verifica si hay una sesión activa en Supabase Auth. Si no la hay, redirige al `/login`. También bloquea el acceso a usuarios que han sido desactivados en la tabla `usuarios`.
- **`RoleGuard.tsx`**: Verifica si el rol del usuario autenticado (ej. `admin`, `recepcionista`, `trabajador`) está dentro de la lista de roles permitidos para la ruta solicitada. Si no lo está, redirige al `/dashboard`.
- **`PublicOnlyRoute.tsx`**: Impide que un usuario que ya inició sesión vea la página de `/login`. Lo redirige automáticamente al `/dashboard`.

## 3. Matriz de Acceso y Rutas (`routes/index.tsx`)
Se actualizaron las rutas de React Router siguiendo el principio de menor privilegio. Ahora todas las rutas están envueltas en los guards:

| Ruta | Roles Permitidos |
|---|---|
| `/login` | (Solo no autenticados) |
| `/dashboard` | `admin`, `trabajador`, `recepcionista` |
| `/citas` | `admin`, `trabajador`, `recepcionista` |
| `/clientes` | `admin`, `recepcionista` |
| `/productos` | `admin` |
| `/servicios` | `admin` |
| `/promociones`| `admin`, `recepcionista` |
| `/ventas` | `admin`, `recepcionista` |
| `/trabajadores` | `admin` |
| `/usuarios` | `admin` |
| `*` (Catch-all) | Redirige al `/login` de forma segura. |

## 4. Mejoras de Seguridad y Experiencia de Usuario (UX)

- **Login Seguro**: Se eliminaron las credenciales quemadas (`manager@...` y `password123`) que venían por defecto en el estado del formulario de login.
- **Redirección Inteligente**: Si un usuario no autenticado intenta entrar directamente a una URL como `/clientes`, es enviado al `/login`. Tras iniciar sesión exitosamente, el sistema lo devuelve automáticamente a la página de `/clientes` que intentaba ver.
- **Topbar Dinámico**: Ahora el Topbar muestra el nombre real del usuario autenticado (obtenido del AuthContext) y sus iniciales, junto con un botón funcional para **Cerrar Sesión**.
- **Sidebar Optimizado**: El Sidebar ahora consume el perfil del AuthContext en lugar de hacer otra petición manual a la base de datos, y filtra los enlaces de navegación según el rol del usuario de forma reactiva. Además, ahora muestra el logo correcto de la empresa en lugar de la letra "P".
- **Feedback Visual (Loaders)**: Se añadieron estilos en CSS (`.auth-loading`, `.auth-loading-spinner`) para mostrar estados de carga elegantes mientras el sistema verifica los tokens JWT con Supabase antes de renderizar la aplicación.
