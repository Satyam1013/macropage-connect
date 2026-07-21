import { IsString, IsNotEmpty, Length, Matches } from "class-validator";

export class RegisterPhoneDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: "PIN must be exactly 6 digits" })
  @Matches(/^\d{6}$/, { message: "PIN must contain only numbers" })
  pin!: string;
}
