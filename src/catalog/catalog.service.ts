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
  // POST /catalog/connect (or /reconnect) with a fresh popup auth code,
  // never silently as a side effect of another operation ──

  async connectCatalog(tenantId: string, code: string) {
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

    if (!code) {
      throw new BadRequestException({
        code: "MISSING_CODE",
        message: "No authorization code received from Facebook.",
      });
    }

    try {
      // Step A — exchange the popup's short-lived code for a user access
      // token, same pattern as WhatsappService.connectMeta()'s Step 1.
      const tokenResponse = await axios.get<{ access_token?: string }>(
        `${META_GRAPH_BASE}/oauth/access_token`,
        {
          params: {
            client_id: process.env.META_APP_ID,
            client_secret: process.env.META_APP_SECRET,
            code,
          },
        },
      );

      const userAccessToken = tokenResponse.data.access_token;
      if (!userAccessToken) {
        throw new BadRequestException("Could not exchange code for token");
      }

      // Step B — fetch the catalog(s) now visible under this business
      // after the merchant created/selected one inside the popup.
      const catalogsResponse = await axios.get<{
        data?: Array<{ id: string; name?: string; vertical?: string }>;
      }>(`${META_GRAPH_BASE}/${waba.metaBusinessId}/owned_product_catalogs`, {
        params: { access_token: userAccessToken, fields: "id,name,vertical" },
      });

      const catalogs = catalogsResponse.data.data ?? [];
      if (catalogs.length === 0) {
        throw new BadRequestException({
          code: "NO_CATALOG_FOUND",
          message: "No catalog was created or selected. Please try again.",
        });
      }

      // Prefer a catalog with the correct commerce vertical if multiple
      // exist; otherwise take the first one returned.
      const catalog =
        catalogs.find(
          (c) => c.vertical === "commerce" || c.vertical === "COMMERCE",
        ) ?? catalogs[0];

      // Step C — link the catalog to the WABA using the SYSTEM USER token
      // (permanent, already stored/encrypted) — not the short-lived popup
      // token from Step A.
      const systemToken = this.encryptionService.decrypt(waba.accessToken);

      await axios.post(
        `${META_GRAPH_BASE}/${waba.wabaId}/product_catalogs`,
        { catalog_id: catalog.id },
        { headers: { Authorization: `Bearer ${systemToken}` } },
      );

      // Step D — enable commerce settings on the phone number
      await axios.post(
        `${META_GRAPH_BASE}/${waba.phoneNumberId}/whatsapp_commerce_settings`,
        { is_catalog_visible: true, is_cart_enabled: true },
        { headers: { Authorization: `Bearer ${systemToken}` } },
      );

      const saved = await this.catalogModel.findOneAndUpdate(
        { tenantId },
        {
          $set: {
            tenantId,
            metaCatalogId: catalog.id,
            metaBusinessId: waba.metaBusinessId,
            isConnected: true,
            connectedAt: new Date(),
            connectionError: null,
          },
        },
        { upsert: true, new: true },
      );

      this.logger.log(
        `Catalog connected for tenant ${tenantId}: ${catalog.id}`,
      );

      return {
        success: true,
        data: {
          message: "Catalog connected successfully",
          metaCatalogId: catalog.id,
          connectedAt: saved.connectedAt,
        },
      };
    } catch (err) {
      const metaMessage =
        (axios.isAxiosError(err) &&
          (err.response?.data as { error?: { message?: string } })?.error
            ?.message) ||
        (err instanceof Error ? err.message : undefined) ||
        "Failed to connect catalog";

      // Persisted so getStatus() can show the merchant exactly what Meta
      // said went wrong, and so support can debug later.
      await this.catalogModel.findOneAndUpdate(
        { tenantId },
        { $set: { isConnected: false, connectionError: metaMessage } },
        { upsert: true },
      );

      this.logger.error(
        `Catalog connect failed for tenant ${tenantId}: ${metaMessage}`,
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
