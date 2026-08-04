import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
} from "class-validator";
import { Type } from "class-transformer";
import type { MessageStatus } from "../../../messages/messages.types";

export class QueryMessageLogsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsMongoId()
  customerId?: string;

  @IsOptional()
  @IsEnum(["PENDING", "SENT", "DELIVERED", "READ", "FAILED"])
  status?: MessageStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
