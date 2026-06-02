-- Agregar columnas para registrar métodos de pago en las reservas
-- Ejecutar en Supabase -> SQL Editor

ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS deposit_payment_method text,
ADD COLUMN IF NOT EXISTS balance_payment_method text;

-- Comentario explicativo de las columnas:
-- deposit_payment_method: Método por el cual se pagó el abono (ej: 'nequi', 'efectivo', 'daviplata')
-- balance_payment_method: Método por el cual se pagó el saldo faltante (ej: 'nequi', 'efectivo', 'daviplata')
