import { IsIn } from "class-validator";

const ORDER_STATUSES = [
  "new",
  "confirmed",
  "payment_pending",
  "paid",
  "fulfilled",
  "cancelled",
] as const;

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES)
  status!: string;
}
