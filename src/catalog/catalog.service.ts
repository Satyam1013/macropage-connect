import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import axios from "axios";
import { Catalog, CatalogDocument } from "./schemas/catalog.schema";
import { Product, ProductDocument } from "./schemas/product.schema";
import {
  WABAAccount,
  WABAAccountDocument,
} from "../schemas/waba-account.schema";
import { EncryptionService } from "../meta/encryption.service";
import { META_GRAPH_BASE } from "../meta/meta.constants";

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @InjectModel(Catalog.name)
    private readonly catalogModel: Model<CatalogDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(WABAAccount.name)
    private readonly wabaModel: Model<WABAAccountDocument>,
    private readonly encryptionService: EncryptionService,
  ) {}

  // ── Create or connect a catalog for this tenant ──

  async ensureCatalog(tenantId: string) {
    let catalog = await this.catalogModel.findOne({ tenantId });
    if (catalog?.isConnected) return catalog;

    const waba = await this.wabaModel.findOne({ tenantId });
    if (!waba?.metaConnected) {
      throw new BadRequestException(
        "Connect WhatsApp before setting up your catalog",
      );
    }

    const accessToken = this.encryptionService.decrypt(waba.accessToken);

    // Create a new product catalog under the business's Meta Business Manager
    const response = await axios.post<{ id: string }>(
      `${META_GRAPH_BASE}/${waba.wabaId}/product_catalogs`,
      {
        name: `${waba.displayName ?? "Macropage"} Catalog`,
        vertical: "commerce",
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    catalog = await this.catalogModel.findOneAndUpdate(
      { tenantId },
      {
        $set: {
          tenantId,
          metaCatalogId: response.data.id,
          isConnected: true,
          connectedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    // Link catalog to the WABA so it's usable in WhatsApp messages
    await axios.post(
      `${META_GRAPH_BASE}/${waba.phoneNumberId}/whatsapp_commerce_settings`,
      {
        is_catalog_visible: true,
        is_cart_enabled: true,
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    return catalog;
  }

  // ── Push a product to Meta's catalog ──────

  async syncProductToMeta(tenantId: string, productId: string) {
    const [catalog, product, waba] = await Promise.all([
      this.catalogModel.findOne({ tenantId }),
      this.productModel.findOne({ _id: productId, tenantId }),
      this.wabaModel.findOne({ tenantId }),
    ]);

    if (!catalog?.isConnected) {
      throw new BadRequestException("Catalog not connected");
    }
    if (!product) {
      throw new BadRequestException("Product not found");
    }
    if (!waba) {
      throw new BadRequestException("WhatsApp account not connected");
    }

    const accessToken = this.encryptionService.decrypt(waba.accessToken);

    const payload = {
      retailer_id: product._id.toString(),
      name: product.name,
      description: product.description ?? "",
      price: product.price, // in paise
      currency: product.currency,
      image_url: product.imageUrls[0] ?? "",
      availability: product.availability,
      condition: "new",
      // optional landing page, can be a placeholder
      url: `${process.env.FRONTEND_URL}/products/${product._id.toString()}`,
    };

    try {
      let metaResponse: { data: { id?: string } };
      if (product.metaProductId) {
        // Update existing
        metaResponse = await axios.post<{ id?: string }>(
          `${META_GRAPH_BASE}/${product.metaProductId}`,
          payload,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
      } else {
        // Create new
        metaResponse = await axios.post<{ id?: string }>(
          `${META_GRAPH_BASE}/${catalog.metaCatalogId}/products`,
          payload,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
      }

      await this.productModel.updateOne(
        { _id: productId },
        {
          $set: {
            metaProductId: metaResponse.data.id ?? product.metaProductId,
            syncStatus: "synced",
            syncError: null,
            lastSyncedAt: new Date(),
          },
        },
      );

      return { success: true };
    } catch (err) {
      const message =
        (axios.isAxiosError(err) &&
          (err.response?.data as { error?: { message?: string } })?.error
            ?.message) ||
        "Sync failed";

      await this.productModel.updateOne(
        { _id: productId },
        { $set: { syncStatus: "failed", syncError: message } },
      );
      throw new BadRequestException(
        "Failed to sync product to WhatsApp catalog",
      );
    }
  }

  // ── Remove product from Meta catalog ──────

  async removeFromMeta(tenantId: string, productId: string) {
    const product = await this.productModel.findOne({
      _id: productId,
      tenantId,
    });
    if (!product?.metaProductId) return;

    const waba = await this.wabaModel.findOne({ tenantId });
    if (!waba) return;

    const accessToken = this.encryptionService.decrypt(waba.accessToken);

    await axios
      .delete(`${META_GRAPH_BASE}/${product.metaProductId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .catch((err: Error) => {
        // best effort — local delete should still proceed
        this.logger.warn(
          `Failed to remove product ${productId} from Meta: ${err.message}`,
        );
      });
  }
}
