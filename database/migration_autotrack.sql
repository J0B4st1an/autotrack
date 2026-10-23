-- AutoTrack: ajustes para la capa de datos PostgreSQL existente.
-- Ejecutar una sola vez conectado como postgres a seguimiento_vehiculos.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT TRUE;

-- Permisos de datos que necesita la API. El historial y las notificaciones
-- siguen siendo generados por el trigger de PostgreSQL al avanzar fases.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.clientes, public.asesores, public.vehiculos,
  public.usuarios, public.checklist_vehiculos
TO app_seguimiento;

GRANT SELECT ON TABLE
  public.fases, public.historial_estados, public.notificaciones
TO app_seguimiento;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_seguimiento;

GRANT EXECUTE ON FUNCTION public.avanzar_fase_vehiculo(VARCHAR) TO app_seguimiento;
REVOKE EXECUTE ON FUNCTION public.avanzar_fase_vehiculo(VARCHAR) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registrar_cambio_fase() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validar_avance_fase() FROM PUBLIC;
