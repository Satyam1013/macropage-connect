import { Types } from "mongoose";
import { CampaignsService } from "./campaigns.service";

const exec = <T>(v: T) => {
  const q = {
    select: () => q,
    lean: () => q,
    exec: () => Promise.resolve(v),
  };
  return q;
};

function setup(recipientCount: number, statuses: string[] = []) {
  const recipients = Array.from({ length: recipientCount }, (_, i) => ({
    _id: `r${i}`,
    contactId: new Types.ObjectId().toString(),
    phone: `91999000${String(i).padStart(4, "0")}`,
  }));
  let statusReads = 0;
  const campaign = {
    _id: "camp",
    tenantId: "tenant",
    name: "c",
    templateId: "tpl",
    variableMapping: {},
    createdBy: "u",
  };
  const campaignModel = {
    findById: jest.fn(() => ({
      ...exec(campaign),
      select: (fields: string) =>
        fields === "status"
          ? exec({ status: statuses[statusReads++] ?? "RUNNING" })
          : exec({ status: "CANCELLED" }),
    })),
    updateOne: jest.fn().mockResolvedValue({}),
  };
  const recipientModel = {
    find: jest.fn(() => exec(recipients)),
    updateOne: jest.fn().mockResolvedValue({}),
  };
  const contactModel = {
    find: jest.fn((filter: { _id: { $in: string[] } }) =>
      exec(filter._id.$in.map((id) => ({ _id: id, name: "N", phone: "1" }))),
    ),
    updateOne: jest.fn().mockResolvedValue({}),
  };
  const templateModel = {
    findById: jest.fn(() =>
      exec({ name: "t", language: "en", category: "MARKETING" }),
    ),
  };
  const client = {
    sendMessage: jest
      .fn()
      .mockResolvedValue({ data: { messages: [{ id: "wamid" }] } }),
  };
  const service = new CampaignsService(
    campaignModel as never,
    recipientModel as never,
    templateModel as never,
    contactModel as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { getClient: () => Promise.resolve(client) } as never,
    { trackOutbound: () => Promise.resolve() } as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const run = () =>
    (
      service as unknown as {
        processCampaign: (id: string, t: string) => Promise<void>;
      }
    ).processCampaign("camp", "tenant");
  return { run, client, contactModel, campaignModel };
}

describe("CampaignsService campaign sending", () => {
  it("sends every recipient in parallel batches, loading contacts per batch", async () => {
    const t = setup(25);
    await t.run();
    expect(t.client.sendMessage).toHaveBeenCalledTimes(25);
    expect(t.contactModel.find).toHaveBeenCalledTimes(2);
    expect(t.campaignModel.updateOne).toHaveBeenCalledWith(
      { _id: "camp" },
      { $inc: { sent: 1 } },
    );
  });

  it("stops before the next batch once the campaign is paused", async () => {
    const t = setup(25, ["RUNNING", "PAUSED"]);
    await t.run();
    expect(t.client.sendMessage).toHaveBeenCalledTimes(20);
  });
});
