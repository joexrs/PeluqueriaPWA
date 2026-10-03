# Procedimientos Almacenados - Supabase

## Citas
- `crear_cita` - Crea una cita con sus servicios
- `actualizar_cita` - Actualiza datos de una cita
- `eliminar_cita` - Elimina una cita (CASCADE con detalles)
- `obtener_citas` - Lista citas con filtros (fecha, rango, trabajador, estado)
- `obtener_cita_por_id` - Obtiene una cita con todos sus detalles
- `obtener_citas_por_fecha` - Citas de un día específico
- `obtener_citas_por_cliente` - Historial de citas de un cliente
- `obtener_citas_de_hoy` - Citas del día actual
- `obtener_citas_de_semana` - Citas de la semana (lunes-domingo)
- `cambiar_estado_cita` - Cambia solo el estado de una cita
- `obtener_citas_pendientes` - Citas pendientes por confirmar

## Detalle Citas Servicios
- `agregar_servicio_a_cita` - Añade un servicio a una cita
- `quitar_servicio_de_cita` - Elimina un servicio de una cita
- `recalcular_monto_cita` - Trigger: recalcula monto_estimado al modificar detalles

## Clientes
- `crear_cliente` - Registra nuevo cliente
- `actualizar_cliente` - Actualiza datos del cliente
- `eliminar_cliente` - Eliminación lógica (activo = false)
- `obtener_clientes` - Lista clientes activos con búsqueda
- `obtener_cliente_por_id` - Cliente específico
- `buscar_clientes` - Búsqueda por nombre, apellido, teléfono, email
- `incrementar_visitas_cliente` - Aumenta total_visitas tras cita completada

## Productos
- `crear_producto` - Registra nuevo producto
- `actualizar_producto` - Actualiza datos del producto
- `eliminar_producto` - Desactiva producto (activo = false)
- `obtener_productos` - Lista productos con filtros (categoría, búsqueda, stock bajo)
- `obtener_producto_por_id` - Producto específico con lotes
- `actualizar_stock_producto` - Actualiza stock_total manualmente
- `obtener_productos_bajos_stock` - Productos con stock <= stock_minimo
- `obtener_productos_proximos_vencer` - Productos con lotes por caducar

## Categorías de Productos
- `crear_categoria_producto` - Nueva categoría
- `actualizar_categoria_producto` - Actualiza categoría
- `eliminar_categoria_producto` - Desactiva categoría
- `obtener_categorias_productos` - Lista todas las categorías

## Proveedores
- `crear_proveedor` - Registra nuevo proveedor
- `actualizar_proveedor` - Actualiza datos del proveedor
- `eliminar_proveedor` - Desactiva proveedor
- `obtener_proveedores` - Lista proveedores activos
- `obtener_proveedor_por_id` - Proveedor específico

## Lotes de Productos
- `crear_lote` - Crea un nuevo lote de producto
- `obtener_lotes_por_producto` - Lotes de un producto específico
- `actualizar_stock_lote` - Actualiza stock_actual del lote
- `obtener_lotes_por_caducar` - Lotes próximos a vencer

## Movimientos de Inventario
- `registrar_entrada` - Registra entrada de inventario (compra)
- `registrar_salida` - Registra salida de inventario (venta/consumo)
- `obtener_movimientos_inventario` - Lista movimientos con filtros
- `obtener_movimientos_por_producto` - Historial de movimientos de un producto
- `obtener_movimientos_por_lote` - Movimientos de un lote específico

## Servicios (Catálogo)
- `crear_servicio` - Registra nuevo servicio
- `actualizar_servicio` - Actualiza servicio
- `eliminar_servicio` - Desactiva servicio
- `obtener_servicios` - Lista servicios activos
- `obtener_servicio_por_id` - Servicio específico

## Promociones
- `crear_promocion` - Registra nueva promoción
- `actualizar_promocion` - Actualiza promoción
- `eliminar_promocion` - Desactiva promoción
- `obtener_promociones` - Lista todas las promociones
- `obtener_promocion_por_id` - Promoción específica
- `obtener_promociones_activas` - Promociones vigentes (activa = true y dentro de fechas)

## Ventas
- `registrar_venta` - Registra una venta
- `obtener_ventas` - Lista ventas con filtros
- `obtener_venta_por_id` - Venta específica
- `obtener_ventas_por_fecha` - Ventas de un día
- `obtener_ventas_del_dia` - Ventas de hoy
- `obtener_ventas_semana` - Ventas de los últimos 7 días
- `obtener_ventas_mes` - Ventas del mes actual
- `calcular_total_ventas_periodo` - Suma de ventas en rango de fechas

## Usuarios / Trabajadores
- `crear_usuario` - Registra nuevo usuario
- `actualizar_usuario` - Actualiza datos del usuario
- `eliminar_usuario` - Desactiva usuario
- `obtener_usuarios` - Lista usuarios activos
- `obtener_usuario_por_id` - Usuario específico
- `cambiar_password_usuario` - Actualiza contraseña
- `obtener_trabajadores` - Lista trabajadores para agenda

## Dashboard / Estadísticas
- `obtener_kpis_dashboard` - Citas hoy, ventas hoy, alertas inventario, pendientes
- `obtener_citas_hoy` - Citas del día actual
- `obtener_proximas_citas` - Próximas citas de hoy ordenadas por hora
- `obtener_ventas_semana` - Ventas agrupadas por día (últimos 7 días)
- `obtener_clientes_nuevos_mes` - Clientes creados este mes
- `obtener_ingresos_mes` - Ingresos del mes actual
- `contar_alertas_inventario` - Cantidad de productos con stock bajo