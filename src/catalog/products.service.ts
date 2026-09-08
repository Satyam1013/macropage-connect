import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Product, ProductDocument } from "./schemas/product.schema";
import { Catalog, CatalogDocument } from "./schemas/catalog.schema";
import { CatalogService } from "./catalog.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Catalog.name)
    private readonly catalogModel: Model<CatalogDocument>,
    private readonly catalogService: CatalogService,
  ) {}

  async create(tenantId: string, dto: CreateProductDto) {
    // Guard: catalog must already be connected. The frontend gates the
    // products page behind catalog setup, but never trust that alone —
    // enforce it at the API layer too.
    const catalog = await this.catalogModel.findOne({
      tenantId,
      isConnected: true,
    });
    if (!catalog) {
      throw new BadRequestException({
        code: "CATALOG_NOT_CONNECTED",
        message: "Connect your catalog before adding products.",
      });
    }

    const product = await this.productModel.create({ tenantId, ...dto });

    // Sync directly (fire and forget, don't block the create response on
    // Meta's API) — catalog is guaranteed to exist, no more ensureCatalog().
    this.catalogService
      .syncProductToMeta(tenantId, product.id)
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
    const [catalog, products] = await Promise.all([
      this.catalogModel.findOne({ tenantId }).lean(),
      this.productModel.find({ tenantId }).sort({ createdAt: -1 }).lean(),
    ]);

    return {
      success: true,
      data: products,
      meta: { catalogConnected: catalog?.isConnected ?? false },
    };
  }
}
