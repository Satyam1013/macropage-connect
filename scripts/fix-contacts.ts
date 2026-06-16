import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  // Check both contacts
  const contacts = await db
    .collection("contacts")
    .find({
      phone: "+919424919969",
    })
    .toArray();

  console.log("All contacts with +919424919969:");
  for (const c of contacts) {
    console.log(
      `  _id: ${c._id.toString()}, tenantId: ${c.tenantId}, name: ${c.name}`,
    );
  }

  const TARGET_TENANT = "6a254f8b9a954a828edc60e0";
  const OLD_CONTACT = "6a255e46000ab12f2dd4de09";
  const DUP_CONTACT = "6a2b99a594f9c9ff054c200f";
  const OLD_CONV = "6a255e69000ab12f2dd4de0a";
  const DUP_CONV = "6a2b99a594f9c9ff054c2011";

  // Fix old contact tenantId if needed
  const oldContact = await db
    .collection("contacts")
    .findOne({ _id: new mongoose.Types.ObjectId(OLD_CONTACT) });
  if (oldContact && oldContact.tenantId !== TARGET_TENANT) {
    console.log(
      `\nFixing old contact tenantId: ${oldContact.tenantId} → ${TARGET_TENANT}`,
    );
    await db
      .collection("contacts")
      .updateOne(
        { _id: new mongoose.Types.ObjectId(OLD_CONTACT) },
        { $set: { tenantId: TARGET_TENANT } },
      );
  }

  // Move messages from dup conversation to old conversation
  const moved = await db
    .collection("messages")
    .updateMany(
      { conversationId: DUP_CONV },
      { $set: { conversationId: OLD_CONV, tenantId: TARGET_TENANT } },
    );
  console.log(
    `\nMoved ${moved.modifiedCount} messages from dup conv → old conv`,
  );

  // Delete dup conversation
  await db
    .collection("conversations")
    .deleteOne({ _id: new mongoose.Types.ObjectId(DUP_CONV) });
  console.log("Deleted dup conversation");

  // Delete dup contact
  await db
    .collection("contacts")
    .deleteOne({ _id: new mongoose.Types.ObjectId(DUP_CONTACT) });
  console.log("Deleted dup contact");

  console.log("\nDone! Contacts after fix:");
  const remaining = await db
    .collection("contacts")
    .find({ phone: "+919424919969" })
    .toArray();
  for (const c of remaining) {
    console.log(
      `  _id: ${c._id.toString()}, tenantId: ${c.tenantId}, name: ${c.name}`,
    );
  }

  await mongoose.disconnect();
}

main().catch(console.error);
