import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Subscription,
  SubscriptionDocument,
} from "../../schemas/subscription.schema";
import {
  FEATURE_PLANS,
  FEATURE_UPGRADE_MESSAGE,
  type PlanFeature,
} from "../billing.constants";
import { PLAN_FEATURE_KEY } from "../../common/decorators/require-plan.decorator";
import type { Plan } from "../billing.types";
import type { AuthReq } from "../../auth/dto/auth-request.interface";

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectModel(Subscription.name)
    private readonly subModel: Model<SubscriptionDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<PlanFeature | undefined>(
      PLAN_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No feature restriction on this route
    if (!feature) return true;

    const req = context.switchToHttp().getRequest<AuthReq>();
    const tenantId = req.user.tenantId ?? req.user.id;

    const sub = await this.subModel
      .findOne({ tenantId })
      .select("plan status")
      .lean()
      .exec();

    const plan: Plan = sub?.plan ?? "TRIAL";
    const status = sub?.status ?? "TRIALING";

    // Subscription expired or cancelled → block paid features
    if (status === "CANCELLED" || status === "EXPIRED") {
      throw new ForbiddenException({
        success: false,
        error: {
          code: "SUBSCRIPTION_INACTIVE",
          message:
            "Your subscription is inactive. Please renew to access this feature.",
          currentPlan: plan,
          requiredPlans: FEATURE_PLANS[feature],
        },
      });
    }

    const allowedPlans = FEATURE_PLANS[feature];
    if (!allowedPlans.includes(plan)) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: "PLAN_UPGRADE_REQUIRED",
          message: FEATURE_UPGRADE_MESSAGE[feature],
          currentPlan: plan,
          requiredPlans: allowedPlans,
          upgradeUrl: "/billing/upgrade",
        },
      });
    }

    return true;
  }
}
