export type Role = "user" | "admin";

export type AuthUser = {
  username: string;
  role: Role;
  avatarUrl?: string | null;
};

export type CanchaId = 1 | 2;

export type Reservation = {
  id: string;
  cancha: CanchaId;
  /** YYYY-MM-DD */
  date: string;
  /** 6..23 */
  hour: number;
  price: number;
  createdAt: string;
  createdBy: string;
};

