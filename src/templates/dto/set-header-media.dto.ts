import { IsString, IsNotEmpty } from "class-validator";

export class SetHeaderMediaDto {
  @IsString()
  @IsNotEmpty()
  mediaUrl!: string;
}
