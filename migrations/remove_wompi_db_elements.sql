-- Eliminar tablas y columnas asociadas a Wompi
-- Ejecutar en Supabase -> SQL Editor

-- 1. Eliminar la tabla de pagos de reservas (específica de Wompi)
DROP TABLE IF EXISTS public.reservation_payments CASCADE;

-- 2. Eliminar las columnas de Wompi en la tabla de reservas
ALTER TABLE public.reservations 
DROP COLUMN IF EXISTS wompi_transaction_id,
DROP COLUMN IF EXISTS deposit_payment_reference;
