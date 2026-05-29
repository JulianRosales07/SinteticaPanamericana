import type { SupabaseClient } from "@supabase/supabase-js";

// Defecto local en caso de que la DB no tenga las reglas cargadas
const DEFAULT_RULES = [
  { court_id: 1, start_hour: 6, end_hour: 17, price_cop: 80000 },
  { court_id: 1, start_hour: 18, end_hour: 23, price_cop: 100000 },
  { court_id: 2, start_hour: 6, end_hour: 17, price_cop: 80000 },
  { court_id: 2, start_hour: 18, end_hour: 23, price_cop: 100000 },
];

export class PricingService {
  private rules: typeof DEFAULT_RULES = [];

  constructor(private supabase: SupabaseClient) {}

  async loadRules() {
    const { data } = await this.supabase
      .from("pricing_rules")
      .select("court_id, start_hour, end_hour, price_cop")
      .eq("active", true);
    this.rules = data && data.length > 0 ? data : DEFAULT_RULES;
  }

  getPriceForHour(courtId: number, hour: number): number {
    const rulesSource = this.rules.length > 0 ? this.rules : DEFAULT_RULES;
    const matched = rulesSource.find(
      (r) => r.court_id === courtId && hour >= r.start_hour && hour <= r.end_hour
    );
    return matched?.price_cop ?? 80000;
  }

  getPriceMap() {
    const rulesSource = this.rules.length > 0 ? this.rules : DEFAULT_RULES;
    return {
      c1Morning: rulesSource.find((r) => r.court_id === 1 && r.start_hour === 6)?.price_cop ?? 80000,
      c1Evening: rulesSource.find((r) => r.court_id === 1 && r.start_hour === 18)?.price_cop ?? 100000,
      c2Morning: rulesSource.find((r) => r.court_id === 2 && r.start_hour === 6)?.price_cop ?? 80000,
      c2Evening: rulesSource.find((r) => r.court_id === 2 && r.start_hour === 18)?.price_cop ?? 100000,
    };
  }
}
