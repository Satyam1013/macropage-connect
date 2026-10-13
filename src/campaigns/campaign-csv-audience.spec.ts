// jest's mock.calls are typed any[] — asserting on recorded arguments
// needs member access on them.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { BadRequestException } from "@nestjs/common";
import axios from "axios";
import { Types } from "mongoose";
import { CampaignsService } from "./campaigns.service";
import { ContactsService } from "../contacts/contacts.service";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const TENANT = "tenant-1";
const FILE_URL = "https://bucket.blr1.digitaloceanspaces.com/uploads/list.csv";

function query<T>(result: T) {
  const q = {
    select: () => q,
    lean: () => q,
    exec: () => Promise.resolve(result),
  };
  return q;
}

function csv(text: string) {
  mockedAxios.get.mockResolvedValue({ data: Buffer.from(text) });
}

describe("ContactsService.prepareCsvAudience", () => {
  function setup(existing: string[], optedOut: string[] = []) {
    const contactModel = {
      find: jest.fn(
        (filter: { isOptedOut?: unknown; phone: { $in: string[] } }) => {
          const inFile = filter.phone.$in;
          if (filter.isOptedOut === undefined) {
            return query(
              inFile
                .filter((p) => existing.includes(p))
                .map((phone) => ({ phone })),
            );
          }
          return query(
            inFile
              .filter((p) => !optedOut.includes(p))
              .map((phone) => ({ _id: new Types.ObjectId(), phone })),
          );
        },
      ),
      insertMany: jest.fn().mockResolvedValue([]),
    };
    const service = new ContactsService(
      contactModel as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, contactModel };
  }

  it("targets exactly the valid, de-duplicated numbers in the file", async () => {
    csv(
      [
        "VEHICLE NUMBER,name,phone",
        "CG13Q0108,ABHISHEK SINGH,6005487734",
        "CG10G0711,ABHISHEK SINGH,6005487734", // duplicate number
        "CG10G1153,ALI RAZA,9826342943",
        "CG12X0378,BAD,12", // invalid
        "CG10G0657,OPTED OUT,8224806655",
      ].join("\n"),
    );
    const { service, contactModel } = setup(
      ["+919826342943"],
      ["+918224806655"],
    );

    const res = await service.prepareCsvAudience(TENANT, FILE_URL, {
      phone: "phone",
      name: "name",
    });

    expect(res.contacts.map((c) => c.phone).sort()).toEqual([
      "+916005487734",
      "+919826342943",
    ]);
    expect(res.stats).toMatchObject({
      totalRows: 5,
      invalid: 1,
      duplicatesInFile: 1,
      optedOut: 1,
      newContacts: 2,
    });
    // Only numbers not already saved are created; existing ones untouched.
    const inserted = contactModel.insertMany.mock.calls[0][0].map(
      (c: { phone: string }) => c.phone,
    );
    expect(inserted.sort()).toEqual(["+916005487734", "+918224806655"]);
  });

  it("rejects files outside our storage before downloading", () => {
    const { service } = setup([]);
    expect(() =>
      service.assertImportFileUrl("https://evil.example.com/list.csv"),
    ).toThrow(BadRequestException);
  });
});

describe("CampaignsService with a CSV audience", () => {
  function setup(campaign: Record<string, unknown>) {
    const campaignId = new Types.ObjectId().toString();
    const doc = {
      _id: campaignId,
      tenantId: TENANT,
      status: "DRAFT",
      audienceTags: [],
      ...campaign,
    };
    const campaignModel = {
      findOne: jest.fn(() => query(doc)),
      findById: jest.fn(() => query(null)),
      create: jest.fn((d: unknown) => Promise.resolve(d)),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const recipientModel = { insertMany: jest.fn().mockResolvedValue([]) };
    const contactModel = { updateMany: jest.fn().mockResolvedValue({}) };
    const contactsService = {
      findAll: jest.fn().mockResolvedValue({ data: [] }),
      prepareCsvAudience: jest.fn().mockResolvedValue({
        contacts: [
          { id: "c1", phone: "+916005487734" },
          { id: "c2", phone: "+919826342943" },
        ],
        stats: {},
      }),
      assertImportFileUrl: jest.fn(),
    };
    const queue = { getJob: jest.fn().mockResolvedValue(null), add: jest.fn() };
    const service = new CampaignsService(
      campaignModel as never,
      recipientModel as never,
      {} as never,
      contactModel as never,
      {} as never,
      contactsService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      queue as never,
    );
    return { service, campaignId, recipientModel, contactsService };
  }

  it("launches to the CSV's numbers only, never all contacts", async () => {
    const t = setup({
      audienceType: "csv",
      csvFileUrl: FILE_URL,
      csvColumnMapping: { phone: "phone" },
    });

    await t.service.launch(TENANT, t.campaignId);

    expect(t.contactsService.findAll).not.toHaveBeenCalled();
    expect(t.contactsService.prepareCsvAudience).toHaveBeenCalledWith(
      TENANT,
      FILE_URL,
      { phone: "phone" },
    );
    const phones = t.recipientModel.insertMany.mock.calls[0][0].map(
      (r: { phone: string }) => r.phone,
    );
    expect(phones).toEqual(["+916005487734", "+919826342943"]);
  });

  it("refuses to launch a CSV campaign that has no file", async () => {
    const t = setup({ audienceType: "csv" });
    await expect(t.service.launch(TENANT, t.campaignId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(t.contactsService.findAll).not.toHaveBeenCalled();
    expect(t.recipientModel.insertMany).not.toHaveBeenCalled();
  });

  it("refuses to create a CSV campaign without csvFileUrl", async () => {
    const t = setup({});
    await expect(
      t.service.create(TENANT, "user-1", { audienceType: "CSV" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("still sends to all (tag-filtered) contacts for other audiences", async () => {
    const t = setup({ audienceType: "all" });
    await t.service.launch(TENANT, t.campaignId);
    expect(t.contactsService.findAll).toHaveBeenCalled();
    expect(t.contactsService.prepareCsvAudience).not.toHaveBeenCalled();
  });
});
