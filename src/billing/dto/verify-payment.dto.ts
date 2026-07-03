import { IsNotEmpty, IsString } from "class-validator";

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  razorpay_subscription_id!: string;

  @IsString()
  @IsNotEmpty()
  razorpay_payment_id!: string;

  @IsString()
  @IsNotEmpty()
  razorpay_signature!: string;
}
