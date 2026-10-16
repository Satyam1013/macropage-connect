// jest's mock.calls are typed any[] — asserting on recorded arguments
// needs member access on them.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { CampaignsService } from "./campaigns.service";

const TENANT = "tenant-1";
const CONTACT = "contact-1";
const NOW = Math.floor(Date.now() / 1000);
const HOUR = 3600;

function query<T>(result: T) {
  const q = {
    select: () => q,
    lean: () => q,
    sort: () => q,
    exec: () => Promise.resolve(result),
  };
  return q;
}

function setup(opts: {
  byMetaId?: Record<string, unknown> | null;
  latest?: Record<string, unknown> | null;
  campaignOwned?: boolean;
  modified?: number;
}) {
  const recipientModel = {
    findOne: jest.fn((filter: Record<string, unknown>) =>
      query(
        filter.metaMessageId ? (opts.byMetaId ?? null) : (opts.latest ?? null),
      ),
    ),
    updateOne: jest
      .fn()
      .mockResolvedValue({ modifiedCount: opts.modified ?? 1 }),
  };
  const campaignModel = {
    exists: jest
      .fn()
      .mockResolvedValue(opts.campaignOwned === false ? null : { _id: "c" }),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const service = new CampaignsService(
    campaignModel as never,
    recipientModel as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, recipientModel, campaignModel };
}

describe("CampaignsService.recordReply", () => {
  it("matches a swipe-reply to the exact campaign message", async () => {
    const t = setup({
      byMetaId: { _id: "r1", campaignId: "camp-A", status: "read" },
      latest: { _id: "r2", campaignId: "camp-B", status: "delivered" },
    });

    await expect(
      t.service.recordReply(TENANT, CONTACT, NOW, "wamid.A"),
    ).resolves.toBe(true);

    const [filter, update] = t.recipientModel.updateOne.mock.calls[0];
    expect(filter._id).toBe("r1");
    expect(update.$set.status).toBe("replied");
    expect(t.campaignModel.updateOne).toHaveBeenCalledWith(
      { _id: "camp-A" },
      { $inc: { replied: 1 } },
    );
  });

  it("attributes a plain message to the latest send within the window", async () => {
    const t = setup({
      latest: { _id: "r2", campaignId: "camp-B", status: "delivered" },
    });
    await expect(t.service.recordReply(TENANT, CONTACT, NOW)).resolves.toBe(
      true,
    );

    const filter = t.recipientModel.findOne.mock.calls[0][0] as {
      contactId: string;
      sentAt: { $gte: Date };
    };
    expect(filter.contactId).toBe(CONTACT);
    expect(filter.sentAt.$gte.getTime()).toBe((NOW - 7 * 24 * HOUR) * 1000);
    expect(t.campaignModel.updateOne).toHaveBeenCalledWith(
      { _id: "camp-B" },
      { $inc: { replied: 1 } },
    );
  });

  it("counts only the first reply per recipient", async () => {
    const already = setup({
      latest: { _id: "r2", campaignId: "camp-B", status: "replied" },
    });
    await expect(
      already.service.recordReply(TENANT, CONTACT, NOW),
    ).resolves.toBe(false);
    expect(already.recipientModel.updateOne).not.toHaveBeenCalled();

    // Lost a race to a concurrent message: no double count.
    const race = setup({
      latest: { _id: "r2", campaignId: "camp-B", status: "read" },
      modified: 0,
    });
    await expect(race.service.recordReply(TENANT, CONTACT, NOW)).resolves.toBe(
      false,
    );
    expect(race.campaignModel.updateOne).not.toHaveBeenCalled();
  });

  it("ignores contacts with no recent campaign send, and other tenants' campaigns", async () => {
    const none = setup({});
    await expect(none.service.recordReply(TENANT, CONTACT, NOW)).resolves.toBe(
      false,
    );

    const foreign = setup({
      latest: { _id: "r2", campaignId: "camp-X", status: "read" },
      campaignOwned: false,
    });
    await expect(
      foreign.service.recordReply(TENANT, CONTACT, NOW),
    ).resolves.toBe(false);
    expect(foreign.recipientModel.updateOne).not.toHaveBeenCalled();
  });
});

describe("CampaignsService.handleDeliveryUpdate", () => {
  it("counts delivered once, ignoring a retried webhook", async () => {
    const t = setup({
      byMetaId: { _id: "r1", campaignId: "camp", status: "sent" },
    });
    await t.service.handleDeliveryUpdate("wamid.1", "delivered", NOW);
    expect(t.campaignModel.updateOne).toHaveBeenCalledWith(
      { _id: "camp" },
      { $inc: { delivered: 1 } },
    );

    const retry = setup({
      byMetaId: {
        _id: "r1",
        campaignId: "camp",
        status: "delivered",
        deliveredAt: new Date(),
      },
    });
    await retry.service.handleDeliveryUpdate("wamid.1", "delivered", NOW);
    expect(retry.recipientModel.updateOne).not.toHaveBeenCalled();
    expect(retry.campaignModel.updateOne).not.toHaveBeenCalled();
  });

  it("counts a read that arrives without delivered as delivered + read", async () => {
    const t = setup({
      byMetaId: { _id: "r1", campaignId: "camp", status: "sent" },
    });
    await t.service.handleDeliveryUpdate("wamid.1", "read", NOW);
    expect(t.campaignModel.updateOne).toHaveBeenCalledWith(
      { _id: "camp" },
      { $inc: { delivered: 1, read: 1 } },
    );
    expect(t.recipientModel.updateOne.mock.calls[0][1].$set.status).toBe(
      "read",
    );
  });

  it("never moves status backwards (read after replied keeps replied)", async () => {
    const t = setup({
      byMetaId: {
        _id: "r1",
        campaignId: "camp",
        status: "replied",
        deliveredAt: new Date(),
      },
    });
    await t.service.handleDeliveryUpdate("wamid.1", "read", NOW);
    const update = t.recipientModel.updateOne.mock.calls[0][1];
    expect(update.$set).not.toHaveProperty("status");
    expect(update.$set).toHaveProperty("readAt");
    expect(t.campaignModel.updateOne).toHaveBeenCalledWith(
      { _id: "camp" },
      { $inc: { read: 1 } },
    );
  });
});
