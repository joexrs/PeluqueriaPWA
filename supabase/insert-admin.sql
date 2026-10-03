-- Insertar usuario administrador
-- NOTA: auth_id debe ser un UUID válido de la tabla auth.users
--       Este script es un ejemplo; ajusta los valores según corresponda

INSERT INTO public.usuarios (
  auth_id,
  dni,
  nombre,
  apellido,
  email,
  telefono,
  rol,
  color_agenda,
  comision_porcentaje,
  activo
) VALUES (
  '00000000-0000-0000-0000-000000000001',  -- Reemplazar con auth.users.id real
  '12345678',
  'Admin',
  'Peluqueria',
  'admin@peluqueria.com',
  '+51999999999',
  'admin'::rol_usuario,
  '#7A2E45',
  0.00,
  true
);