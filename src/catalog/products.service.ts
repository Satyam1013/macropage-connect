import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Product, ProductDocument } from "./schemas/product.schema";
import { CatalogService } from "./catalog.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly catalogService: CatalogService,
  ) {}

  async create(tenantId: string, dto: CreateProductDto) {
    const product = await this.productModel.create({ tenantId, ...dto });

    // Ensure catalog exists, then sync (fire and forget, don't block the
    // create response on Meta's API)
    this.catalogService
      .ensureCatalog(tenantId)
      .then(() => this.catalogService.syncProductToMeta(tenantId, product.id))
      .catch((err: Error) => this.logger.error(`Sync failed: ${err.message}`));

    return { success: true, data: product };
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    const product = await this.productModel.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: { ...dto, syncStatus: "pending" } },
      { new: true },
    );

    if (product) {
      this.catalogService
        .syncProductToMeta(tenantId, id)
        .catch((err: Error) =>
          this.logger.error(`Sync failed: ${err.message}`),
        );
    }

    return { success: true, data: product };
  }

  async delete(tenantId: string, id: string) {
    await this.catalogService.removeFromMeta(tenantId, id);
    await this.productModel.deleteOne({ _id: id, tenantId });
    return { success: true };
  }

  async findAll(tenantId: string) {
    const products = await this.productModel
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .lean();
    return { success: true, data: products };
  }
}
