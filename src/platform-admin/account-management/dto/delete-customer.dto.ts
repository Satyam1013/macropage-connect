import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class DeleteCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;

  @IsString()
  @IsNotEmpty()
  confirmEmail!: string;
}
