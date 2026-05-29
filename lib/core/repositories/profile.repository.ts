import type { SupabaseClient } from "@supabase/supabase-js";

export class ProfileRepository {
  constructor(private supabase: SupabaseClient) {}

  async getProfile(userId: string) {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("username, phone, role")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  async updateProfile(userId: string, data: { username: string; phone: string }) {
    const { error } = await this.supabase
      .from("profiles")
      .update(data)
      .eq("id", userId);

    if (error) {
      throw new Error(error.message);
    }
  }

  async getAllProfiles() {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("id, username, phone, role");

    if (error) {
      throw new Error(error.message);
    }
    return data;
  }
}
