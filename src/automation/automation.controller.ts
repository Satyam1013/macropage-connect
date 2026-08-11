import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from "@nestjs/common";
import { AutomationService } from "./automation.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";
import { PlanGuard } from "../billing/guards/plan.guard";
import { RequirePlan } from "../common/decorators/require-plan.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../auth/auth.constants";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard, ProjectAccessGuard, RolesGuard, PlanGuard)
@Controller("projects/:projectId/automation")
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  // ─── Limits (no plan gate — every role needs to know what's locked) ────────

  @Get("limits")
  getLimits(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.automationService.getAutomationLimits(tenantId);
  }

  @Get("stats")
  getStats(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.automationService.getStats(tenantId);
  }

  // ─── Rules ────────────────────────────────────────────────────────────────

  @Get("rules/test")
  async testRules(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    const result = await this.automationService.debugRules(tenantId);
    return result;
  }

  @Get("rules")
  @RequirePlan("automation")
  findRules(@Request() req: ProjectAuthReq) {
    return this.automationService.findAllRules(req.projectId);
  }

  @Post("rules")
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("automation")
  async createRule(
    @Request() req: ProjectAuthReq,
    @Body() dto: Record<string, unknown>,
  ) {
    const tenantId = req.projectId;
    const limits = await this.automationService.getAutomationLimits(tenantId);

    if (
      limits.data.maxCustomRules !== -1 &&
      limits.data.currentRuleCount >= limits.data.maxCustomRules
    ) {
      throw new ForbiddenException({
        code: "RULE_LIMIT_REACHED",
        message: `Your plan allows up to ${limits.data.maxCustomRules} custom rules. Upgrade to add more.`,
        limit: limits.data.maxCustomRules,
        current: limits.data.currentRuleCount,
      });
    }

    return this.automationService.createRule(tenantId, dto);
  }

  @Put("rules/:id")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("automation")
  updateRule(
    @Request() req: ProjectAuthReq,
    @Param("id") id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.automationService.updateRule(req.projectId, id, dto);
  }

  @Patch("rules/:id/toggle")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("automation")
  toggleRule(
    @Request() req: ProjectAuthReq,
    @Param("id") id: string,
    @Body("enabled") enabled: boolean,
  ) {
    return this.automationService.toggleRule(req.projectId, id, enabled);
  }

  @Delete("rules/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("automation")
  deleteRule(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    return this.automationService.deleteRule(req.projectId, id);
  }

  // ─── Flows ────────────────────────────────────────────────────────────────

  @Get("flows")
  @RequirePlan("flowBuilder")
  findFlows(@Request() req: ProjectAuthReq) {
    return this.automationService.findAllFlows(req.projectId);
  }

  @Get("flows/:id")
  @RequirePlan("flowBuilder")
  findFlow(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    return this.automationService.findOneFlow(req.projectId, id);
  }

  @Post("flows")
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("flowBuilder")
  createFlow(
    @Request() req: ProjectAuthReq,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.automationService.saveFlow(req.projectId, undefined, dto);
  }

  @Put("flows/:id")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("flowBuilder")
  updateFlow(
    @Request() req: ProjectAuthReq,
    @Param("id") id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.automationService.saveFlow(req.projectId, id, dto);
  }

  @Post("flows/:id/publish")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("flowBuilder")
  publishFlow(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    return this.automationService.publishFlow(req.projectId, id);
  }

  @Patch("flows/:id/toggle")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("flowBuilder")
  toggleFlow(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    return this.automationService.toggleFlow(req.projectId, id);
  }

  @Delete("flows/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("flowBuilder")
  deleteFlow(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    return this.automationService.deleteFlow(req.projectId, id);
  }
}
