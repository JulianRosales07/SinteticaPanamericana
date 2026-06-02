import type { SupabaseClient } from "@supabase/supabase-js";

export class InvoiceRepository {
  constructor(private supabase: SupabaseClient) {}

  async getInvoices() {
    const { data, error } = await this.supabase
      .from("invoices")
      .select(`
        *,
        reservations (
          court_id,
          date,
          hour,
          price_cop,
          status,
          confirmed
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  async getInvoiceById(id: string) {
    const { data, error } = await this.supabase
      .from("invoices")
      .select(`
        *,
        reservations (
          court_id,
          date,
          hour,
          price_cop,
          status,
          confirmed
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  async updateInvoice(id: string, patch: { amount_paid?: number; payment_status?: string; updated_at?: string }) {
    const { error } = await this.supabase
      .from("invoices")
      .update(patch)
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
