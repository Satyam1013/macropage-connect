import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class SuspendCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
