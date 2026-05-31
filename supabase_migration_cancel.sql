-- Migración: Agregar columnas para cancelación de reservas por el usuario
-- Ejecutar en Supabase SQL Editor

-- Columnas de auditoría de cancelación
ALTER TABLE public.reservations 
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS refund_status text;

-- Comentarios
COMMENT ON COLUMN public.reservations.cancelled_at IS 'Timestamp de cuando se canceló la reserva';
COMMENT ON COLUMN public.reservations.cancelled_by IS 'Quién canceló: user, admin, system';
COMMENT ON COLUMN public.reservations.refund_status IS 'Estado del reembolso: refunded, refund_failed, null si no aplica';
