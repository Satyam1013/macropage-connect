import { IsDateString, IsEnum, IsMongoId, IsOptional } from "class-validator";

export type StatsGroupBy = "day" | "week" | "month";

export class QueryMessageStatsDto {
  @IsOptional()
  @IsMongoId()
  customerId?: string;

  @IsOptional()
  @IsEnum(["day", "week", "month"])
  groupBy?: StatsGroupBy = "day";

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
