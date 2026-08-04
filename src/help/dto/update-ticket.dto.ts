import { IsEnum } from "class-validator";

export class UpdateTicketDto {
  @IsEnum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"])
  status!: string;
}
