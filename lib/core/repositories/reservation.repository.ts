import type { SupabaseClient } from "@supabase/supabase-js";

export class ReservationRepository {
  constructor(private supabase: SupabaseClient) {}

  async getReservationsByUser(userId: string) {
    const { data, error } = await this.supabase
      .from("reservations")
      .select(`
        *,
        invoices (
          id,
          invoice_number,
          payment_status,
          amount_paid,
          amount_total
        )
      `)
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("hour", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  async getPricingRules() {
    const { data, error } = await this.supabase
      .from("pricing_rules")
      .select("court_id, start_hour, end_hour, price_cop")
      .eq("active", true);

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  async createReservation(reservation: {
    user_id: string;
    created_by: string;
    court_id: number;
    date: string;
    hour: number;
    price_cop: number;
    status: string;
  }) {
    const { data, error } = await this.supabase
      .from("reservations")
      .insert(reservation)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  async updateReservation(id: string, patch: Record<string, any>) {
    const { error } = await this.supabase
      .from("reservations")
      .update(patch)
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  }

  async deleteReservation(id: string) {
    const { error } = await this.supabase
      .from("reservations")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  }
}
