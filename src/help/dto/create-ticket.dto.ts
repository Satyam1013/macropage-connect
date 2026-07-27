import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsArray,
} from "class-validator";
import { Transform } from "class-transformer";

const CATEGORIES = [
  "bug",
  "feature_request",
  "billing",
  "account",
  "technical",
  "other",
] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: string;

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: string;

  // Drop anything that isn't a real URL string instead of rejecting the
  // whole ticket — an attachment upload that hadn't finished (or failed)
  // shouldn't block someone from submitting a support request.
  @IsOptional()
  @IsArray()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.filter(
          (v): v is string => typeof v === "string" && /^https?:\/\//.test(v),
        )
      : [],
  )
  attachments?: string[];
}
