import { IsString, IsNotEmpty } from "class-validator";

export class CreateQrMessageDto {
  @IsString()
  @IsNotEmpty()
  message!: string;
}
