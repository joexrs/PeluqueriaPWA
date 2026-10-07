# Implementación de Seguridad y Enrutamiento Protegido

Este documento detalla la implementación de seguridad a nivel de rutas, autenticación global y protección por roles realizada en el proyecto PWA de Peluquería & Estética.

## 1. Supabase Auth y contexto (`AuthContext.tsx`)
El formulario inicia sesión por correo y contraseña mediante Supabase Auth.
El contexto recupera la sesión con `getSession`, escucha cambios con
`onAuthStateChange`, verifica al usuario con `getUser` y busca el perfil en
`public."Usuario"` usando `auth_user_id = user.id`. El rol se obtiene de la relación
`public."Rol"` mediante `Rol_id`; no se asigna un rol predeterminado.

El cliente del frontend solo necesita `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY`. La persistencia de sesión la gestiona Supabase Auth.
La `service_role` no se utiliza en el frontend.

## 2. Route Guards (Protectores de Rutas)
Se implementaron tres componentes clave para proteger las rutas:

- **`ProtectedRoute.tsx`**: Espera la comprobación inicial de Auth; sin usuario redirige al `/login` y exige perfil y rol activos para entrar a la app.
- **`RoleGuard.tsx`**: Verifica si el rol del usuario autenticado (ej. `admin`, `recepcionista`, `trabajador`) está dentro de la lista de roles permitidos para la ruta solicitada. Si no lo está, redirige al `/dashboard`.
- **`PublicOnlyRoute.tsx`**: Impide que un usuario que ya inició sesión vea la página de `/login`. Lo redirige automáticamente al `/dashboard`.

## 3. Matriz de Acceso y Rutas (`routes/index.tsx`)
Se actualizaron las rutas de React Router siguiendo el principio de menor privilegio. Ahora todas las rutas están envueltas en los guards:

| Ruta | Roles Permitidos |
|---|---|
| `/login` | (Solo no autenticados) |
| `/dashboard` | `admin`, `jefe`, `trabajador`, `recepcionista` |
| `/citas` | `admin`, `jefe`, `trabajador`, `recepcionista` |
| `/clientes` | `admin`, `jefe`, `recepcionista` |
| `/productos` | `admin`, `jefe` |
| `/servicios` | `admin`, `jefe` |
| `/promociones`| `admin`, `jefe`, `recepcionista` |
| `/ventas` | `admin`, `jefe`, `recepcionista` |
| `/trabajadores` | `admin`, `jefe` |
| `/usuarios` | `admin` |
| `*` (Catch-all) | Redirige al `/login` de forma segura. |

`jefe` puede operar el negocio, pero no administrar usuarios; `admin` conserva
el acceso a la gestión de cuentas.

## 4. Mejoras de Seguridad y Experiencia de Usuario (UX)

- **Login Seguro**: Supabase Auth valida el correo y la contraseña; las credenciales no están incluidas en el código.
- **Redirección Inteligente**: Si un usuario no autenticado intenta entrar directamente a una URL como `/clientes`, es enviado al `/login`. Tras iniciar sesión exitosamente, el sistema lo devuelve automáticamente a la página de `/clientes` que intentaba ver.
- **Topbar Dinámico**: Ahora el Topbar muestra el nombre real del usuario autenticado (obtenido del AuthContext) y sus iniciales, junto con un botón funcional para **Cerrar Sesión**.
- **Sidebar Optimizado**: El Sidebar ahora consume el perfil del AuthContext en lugar de hacer otra petición manual a la base de datos, y filtra los enlaces de navegación según el rol del usuario de forma reactiva. Además, ahora muestra el logo correcto de la empresa en lugar de la letra "P".
- **RLS del perfil**: la migración `supabase/migrations/20261007134400_auth_profile_rls.sql` vincula `public."Usuario".auth_user_id` con `auth.users.id` y permite que cada sesión lea únicamente su propio perfil y el rol asociado. También limita las columnas legibles para no exponer el hash de `Contraseña`. Después de ejecutarla, cada perfil existente debe vincularse manualmente con el UUID correcto de Supabase Auth.
- **RLS de las demás tablas**: las tablas de negocio permanecen protegidas y sin políticas de acceso de cliente. Las lecturas/escrituras de citas, clientes, ventas y catálogos requieren políticas específicas antes de que esas pantallas puedan operar directamente con la clave `authenticated`.
