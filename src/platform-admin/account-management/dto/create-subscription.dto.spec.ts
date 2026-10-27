import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateSubscriptionDto } from "./create-subscription.dto";

async function check(body: Record<string, unknown>) {
  const dto = plainToInstance(CreateSubscriptionDto, body);
  const errors = await validate(dto);
  return {
    dto,
    messages: errors.flatMap((e) => Object.values(e.constraints ?? {})),
  };
}

describe("CreateSubscriptionDto", () => {
  it("normalizes planId and billingCycle case", async () => {
    const { dto, messages } = await check({
      planId: " starter ",
      billingCycle: "Monthly",
      startDate: "2026-10-26",
      amountPaid: 0,
      paymentMode: "manual",
    });
    expect(messages).toEqual([]);
    expect(dto.planId).toBe("STARTER");
    expect(dto.billingCycle).toBe("monthly");
  });

  it("gives readable messages for missing/invalid fields", async () => {
    const { messages } = await check({ billingCycle: "weekly" });
    expect(messages).toEqual(
      expect.arrayContaining([
        "planId is required",
        "billingCycle must be monthly, quarterly or yearly",
      ]),
    );
  });
});
