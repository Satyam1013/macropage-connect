import { IsString, IsNotEmpty, MinLength } from "class-validator";

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  businessName!: string;
}
