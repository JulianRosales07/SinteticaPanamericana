import type { SupabaseClient } from "@supabase/supabase-js";
import { InvoiceRepository } from "../repositories/invoice.repository";
import { ReservationRepository } from "../repositories/reservation.repository";

export class BillingService {
  private invoiceRepo: InvoiceRepository;
  private reservationRepo: ReservationRepository;

  constructor(supabase: SupabaseClient) {
    this.invoiceRepo = new InvoiceRepository(supabase);
    this.reservationRepo = new ReservationRepository(supabase);
  }

  async getAllInvoices() {
    return this.invoiceRepo.getInvoices();
  }

  async getInvoiceDetail(id: string) {
    return this.invoiceRepo.getInvoiceById(id);
  }

  async markInvoiceAsPaid(invoiceId: string, amountTotal: number, reservationId?: string) {
    const now = new Date().toISOString();

    await this.invoiceRepo.updateInvoice(invoiceId, {
      amount_paid: amountTotal,
      payment_status: "paid",
      updated_at: now,
    });

    if (reservationId) {
      await this.reservationRepo.updateReservation(reservationId, {
        confirmed: true,
        deposit_paid: true,
        deposit_cop: amountTotal,
        deposit_status: "APPROVED",
        confirmed_at: now,
      });
    }
  }

  async markInvoiceAsCancelled(invoiceId: string, reservationId?: string) {
    await this.invoiceRepo.updateInvoice(invoiceId, {
      payment_status: "cancelled",
      updated_at: new Date().toISOString(),
    });

    if (reservationId) {
      await this.reservationRepo.updateReservation(reservationId, {
        status: "cancelled",
      });
    }
  }
}
