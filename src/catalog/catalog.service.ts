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

  // ── Check status — read only, no side effects ──

  async getStatus(tenantId: string) {
    const [catalog, waba] = await Promise.all([
      this.catalogModel.findOne({ tenantId }).lean(),
      this.wabaModel
        .findOne({ tenantId })
        .select("metaConnected metaBusinessId")
        .lean(),
    ]);

    return {
      success: true,
      data: {
        isConnected: catalog?.isConnected ?? false,
        metaCatalogId: catalog?.metaCatalogId ?? null,
        connectedAt: catalog?.connectedAt ?? null,
        connectionError: catalog?.connectionError ?? null,
        // Frontend needs to know if WhatsApp itself is connected first —
        // catalog setup requires WhatsApp to already be connected.
        whatsappConnected: waba?.metaConnected ?? false,
        hasBusinessId: !!waba?.metaBusinessId,
      },
    };
  }

  // ── Explicit connect action — only ever triggered by the user hitting
  // POST /catalog/connect, never silently as a side effect of another
  // operation (e.g. creating a product) ──

  async connectCatalog(tenantId: string, isReconnect = false) {
    const waba = await this.wabaModel.findOne({ tenantId });
    if (!waba?.metaConnected) {
      throw new BadRequestException({
        code: "WHATSAPP_NOT_CONNECTED",
        message:
          "Connect your WhatsApp Business Account first, before setting up your catalog.",
      });
    }

    if (!waba.metaBusinessId) {
      throw new BadRequestException({
        code: "BUSINESS_ID_MISSING",
        message:
          "Business ID not found. Please reconnect WhatsApp to refresh this.",
      });
    }

    const existing = await this.catalogModel.findOne({ tenantId });
    if (existing?.isConnected && !isReconnect) {
      return {
        success: true,
        data: { message: "Catalog already connected", ...existing.toObject() },
      };
    }

    const accessToken = this.encryptionService.decrypt(waba.accessToken);

    try {
      // Step A — create the catalog under the Business (not the WABA)
      const catalogResponse = await axios.post<{ id: string }>(
        `${META_GRAPH_BASE}/${waba.metaBusinessId}/owned_product_catalogs`,
        {
          name: `${waba.displayName ?? "Macropage"} Catalog`,
          vertical: "commerce",
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const metaCatalogId = catalogResponse.data.id;

      // Step B — connect that catalog to the WABA
      await axios.post(
        `${META_GRAPH_BASE}/${waba.wabaId}/product_catalogs`,
        { catalog_id: metaCatalogId },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      // Step C — enable commerce settings on the phone number
      await axios.post(
        `${META_GRAPH_BASE}/${waba.phoneNumberId}/whatsapp_commerce_settings`,
        { is_catalog_visible: true, is_cart_enabled: true },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      const catalog = await this.catalogModel.findOneAndUpdate(
        { tenantId },
        {
          $set: {
            tenantId,
            metaCatalogId,
            metaBusinessId: waba.metaBusinessId,
            isConnected: true,
            connectedAt: new Date(),
            connectionError: null,
          },
        },
        { upsert: true, new: true },
      );

      return {
        success: true,
        data: {
          message: "Catalog connected successfully",
          metaCatalogId,
          connectedAt: catalog.connectedAt,
        },
      };
    } catch (err) {
      const metaMessage =
        (axios.isAxiosError(err) &&
          (err.response?.data as { error?: { message?: string } })?.error
            ?.message) ||
        "Failed to connect catalog";

      // Persisted so getStatus() can show the merchant exactly what Meta
      // said went wrong, and so support can debug later.
      await this.catalogModel.findOneAndUpdate(
        { tenantId },
        { $set: { isConnected: false, connectionError: metaMessage } },
        { upsert: true },
      );

      throw new BadRequestException({
        code: "CATALOG_CONNECT_FAILED",
        message: metaMessage,
      });
    }
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
