import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Order, OrderDocument } from "./schemas/order.schema";
import { Contact, ContactDocument } from "../schemas/contact.schema";

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
  ) {}

  async findAll(
    tenantId: string,
    opts: { status?: string; page?: number; limit?: number } = {},
  ) {
    const { status, page = 1, limit = 20 } = opts;
    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(where)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.orderModel.countDocuments(where),
    ]);

    const contactIds = [...new Set(orders.map((o) => o.contactId))];
    const contacts = contactIds.length
      ? await this.contactModel
          .find({ _id: { $in: contactIds } })
          .select("name phone")
          .lean()
          .exec()
      : [];
    const contactMap = Object.fromEntries(
      contacts.map((c) => [String(c._id), c]),
    );

    const data = orders.map((o) => ({
      ...o,
      contact: contactMap[o.contactId] ?? null,
    }));

    return { success: true, data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const order = await this.orderModel
      .findOne({ _id: id, tenantId })
      .lean()
      .exec();
    if (!order) throw new NotFoundException("Order not found");

    const contact = await this.contactModel
      .findOne({ _id: order.contactId, tenantId })
      .select("name phone email")
      .lean()
      .exec();

    return { success: true, data: { ...order, contact: contact ?? null } };
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    const order = await this.orderModel
      .findOneAndUpdate(
        { _id: id, tenantId },
        { $set: { status } },
        { new: true },
      )
      .exec();
    if (!order) throw new NotFoundException("Order not found");
    return { success: true, data: order };
  }
}
