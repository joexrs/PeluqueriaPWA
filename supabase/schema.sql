-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.usuarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_id uuid UNIQUE,
  dni character varying UNIQUE,
  nombre character varying NOT NULL,
  apellido character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  telefono character varying,
  rol USER-DEFINED NOT NULL DEFAULT 'trabajador'::rol_usuario,
  color_agenda character varying DEFAULT '#3B82F6'::character varying CHECK (color_agenda::text ~ '^#[0-9A-Fa-f]{6}$'::text),
  comision_porcentaje numeric DEFAULT 0.00 CHECK (comision_porcentaje >= 0::numeric AND comision_porcentaje <= 100::numeric),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_auth_id_fkey FOREIGN KEY (auth_id) REFERENCES auth.users(id)
);
CREATE TABLE public.horarios_usuario (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  dia_semana integer NOT NULL CHECK (dia_semana >= 1 AND dia_semana <= 7),
  hora_inicio time without time zone NOT NULL,
  hora_fin time without time zone NOT NULL,
  hora_inicio_receso time without time zone,
  hora_fin_receso time without time zone,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT horarios_usuario_pkey PRIMARY KEY (id),
  CONSTRAINT horarios_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.clientes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre character varying NOT NULL,
  apellido character varying,
  telefono character varying NOT NULL UNIQUE,
  email character varying,
  fecha_nacimiento date,
  notas_preferencias text,
  total_visitas integer NOT NULL DEFAULT 0 CHECK (total_visitas >= 0),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clientes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.categorias_servicios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  color character varying DEFAULT '#7A2E45'::character varying CHECK (color::text ~ '^#[0-9A-Fa-f]{6}$'::text),
  CONSTRAINT categorias_servicios_pkey PRIMARY KEY (id)
);
CREATE TABLE public.servicios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  categoria_id uuid,
  nombre character varying NOT NULL UNIQUE,
  descripcion text,
  precio_base numeric NOT NULL CHECK (precio_base >= 0::numeric),
  duracion_minutos integer NOT NULL CHECK (duracion_minutos > 0),
  tiempo_limpieza_minutos integer NOT NULL DEFAULT 5 CHECK (tiempo_limpieza_minutos >= 0),
  aforo_maximo_diario integer NOT NULL DEFAULT 10 CHECK (aforo_maximo_diario > 0),
  aforo_simultaneo_maximo integer NOT NULL DEFAULT 2 CHECK (aforo_simultaneo_maximo > 0),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT servicios_pkey PRIMARY KEY (id),
  CONSTRAINT servicios_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_servicios(id)
);
CREATE TABLE public.usuario_servicios (
  usuario_id uuid NOT NULL,
  servicio_id uuid NOT NULL,
  CONSTRAINT usuario_servicios_pkey PRIMARY KEY (usuario_id, servicio_id),
  CONSTRAINT usuario_servicios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id),
  CONSTRAINT usuario_servicios_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id)
);
CREATE TABLE public.proveedores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ruc character varying UNIQUE,
  razon_social character varying NOT NULL,
  contacto_nombre character varying,
  telefono character varying,
  email character varying,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT proveedores_pkey PRIMARY KEY (id)
);
CREATE TABLE public.categorias_productos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre character varying NOT NULL UNIQUE,
  CONSTRAINT categorias_productos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.productos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  categoria_id uuid,
  proveedor_id uuid,
  codigo_barras character varying UNIQUE,
  nombre character varying NOT NULL,
  marca character varying NOT NULL,
  unidad_medida character varying NOT NULL DEFAULT 'UNIDAD'::character varying,
  stock_total integer NOT NULL DEFAULT 0 CHECK (stock_total >= 0),
  stock_minimo integer NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
  precio_venta_publico numeric NOT NULL CHECK (precio_venta_publico >= 0::numeric),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT productos_pkey PRIMARY KEY (id),
  CONSTRAINT productos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_productos(id),
  CONSTRAINT productos_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id)
);
CREATE TABLE public.lotes_producto (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL,
  numero_lote character varying NOT NULL,
  costo_unitario numeric NOT NULL CHECK (costo_unitario >= 0::numeric),
  cantidad_inicial integer NOT NULL CHECK (cantidad_inicial > 0),
  stock_actual integer NOT NULL CHECK (stock_actual >= 0),
  fecha_ingreso date NOT NULL DEFAULT CURRENT_DATE,
  fecha_caducidad date,
  CONSTRAINT lotes_producto_pkey PRIMARY KEY (id),
  CONSTRAINT lotes_producto_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id)
);
CREATE TABLE public.movimientos_inventario (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lote_id uuid,
  producto_id uuid NOT NULL,
  usuario_id uuid,
  tipo_movimiento USER-DEFINED NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  motivo text NOT NULL,
  fecha_movimiento timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT movimientos_inventario_pkey PRIMARY KEY (id),
  CONSTRAINT movimientos_inventario_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.lotes_producto(id),
  CONSTRAINT movimientos_inventario_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id),
  CONSTRAINT movimientos_inventario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.citas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo_cita character varying NOT NULL DEFAULT ('C-'::text || substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 7)) UNIQUE,
  cliente_id uuid NOT NULL,
  trabajador_id uuid,
  fecha date NOT NULL,
  hora_inicio time without time zone NOT NULL,
  hora_fin time without time zone NOT NULL,
  estado USER-DEFINED NOT NULL DEFAULT 'PENDIENTE'::estado_cita,
  origen USER-DEFINED NOT NULL DEFAULT 'PWA_RECEPCION'::origen_cita,
  monto_estimado numeric NOT NULL DEFAULT 0.00 CHECK (monto_estimado >= 0::numeric),
  notas text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT citas_pkey PRIMARY KEY (id),
  CONSTRAINT citas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT citas_trabajador_id_fkey FOREIGN KEY (trabajador_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.detalle_citas_servicios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cita_id uuid NOT NULL,
  servicio_id uuid NOT NULL,
  precio_aplicado numeric NOT NULL CHECK (precio_aplicado >= 0::numeric),
  duracion_minutos integer NOT NULL CHECK (duracion_minutos > 0),
  CONSTRAINT detalle_citas_servicios_pkey PRIMARY KEY (id),
  CONSTRAINT detalle_citas_servicios_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES public.citas(id),
  CONSTRAINT detalle_citas_servicios_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id)
);
CREATE TABLE public.promociones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  codigo_cupon character varying UNIQUE,
  nombre character varying NOT NULL,
  porcentaje_descuento numeric NOT NULL DEFAULT 0.00 CHECK (porcentaje_descuento >= 0::numeric AND porcentaje_descuento <= 100::numeric),
  monto_fijo_descuento numeric NOT NULL DEFAULT 0.00 CHECK (monto_fijo_descuento >= 0::numeric),
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  es_cumpleanios boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT promociones_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ventas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero_ticket character varying NOT NULL DEFAULT ((('T-'::text || to_char(now(), 'YYYYMMDD'::text)) || '-'::text) || substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 6)) UNIQUE,
  cita_id uuid UNIQUE,
  cliente_id uuid NOT NULL,
  vendedor_usuario_id uuid,
  promocion_id uuid,
  subtotal_servicios numeric NOT NULL DEFAULT 0.00 CHECK (subtotal_servicios >= 0::numeric),
  subtotal_productos numeric NOT NULL DEFAULT 0.00 CHECK (subtotal_productos >= 0::numeric),
  descuento_total numeric NOT NULL DEFAULT 0.00 CHECK (descuento_total >= 0::numeric),
  monto_total numeric NOT NULL CHECK (monto_total >= 0::numeric),
  estado USER-DEFINED NOT NULL DEFAULT 'PAGADA'::estado_venta_enum,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ventas_pkey PRIMARY KEY (id),
  CONSTRAINT ventas_cita_id_fkey FOREIGN KEY (cita_id) REFERENCES public.citas(id),
  CONSTRAINT ventas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT ventas_vendedor_usuario_id_fkey FOREIGN KEY (vendedor_usuario_id) REFERENCES public.usuarios(id),
  CONSTRAINT ventas_promocion_id_fkey FOREIGN KEY (promocion_id) REFERENCES public.promociones(id)
);
CREATE TABLE public.detalle_venta_servicios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL,
  servicio_id uuid NOT NULL,
  trabajador_id uuid,
  precio_unitario numeric NOT NULL CHECK (precio_unitario >= 0::numeric),
  CONSTRAINT detalle_venta_servicios_pkey PRIMARY KEY (id),
  CONSTRAINT detalle_venta_servicios_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id),
  CONSTRAINT detalle_venta_servicios_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicios(id),
  CONSTRAINT detalle_venta_servicios_trabajador_id_fkey FOREIGN KEY (trabajador_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.detalle_venta_productos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL,
  producto_id uuid NOT NULL,
  lote_id uuid,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL CHECK (precio_unitario >= 0::numeric),
  subtotal numeric NOT NULL CHECK (subtotal >= 0::numeric),
  CONSTRAINT detalle_venta_productos_pkey PRIMARY KEY (id),
  CONSTRAINT detalle_venta_productos_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id),
  CONSTRAINT detalle_venta_productos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id),
  CONSTRAINT detalle_venta_productos_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.lotes_producto(id)
);
CREATE TABLE public.pagos_metodos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  venta_id uuid NOT NULL,
  metodo_pago USER-DEFINED NOT NULL,
  monto numeric NOT NULL CHECK (monto > 0::numeric),
  numero_operacion character varying,
  CONSTRAINT pagos_metodos_pkey PRIMARY KEY (id),
  CONSTRAINT pagos_metodos_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id)
);
CREATE TABLE public.bot_sesiones (
  telefono character varying NOT NULL,
  paso_actual character varying NOT NULL DEFAULT 'INICIO'::character varying,
  datos_contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  ultima_interaccion timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bot_sesiones_pkey PRIMARY KEY (telefono)
);