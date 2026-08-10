import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../auth/auth.constants";
import type { AuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("catalog/products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.productsService.findAll(tenantId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(@Request() req: AuthReq, @Body() dto: CreateProductDto) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.productsService.create(tenantId, dto);
  }

  @Put(":id")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.productsService.update(tenantId, id, dto);
  }

  @Delete(":id")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  delete(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.productsService.delete(tenantId, id);
  }
}
