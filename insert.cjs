// insert.cjs
const admin = require("firebase-admin");
const fs = require("fs");
const fetch = require("node-fetch"); // add: npm install node-fetch

const serviceAccount = JSON.parse(fs.readFileSync("./security-key.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function backfillImageSizes() {
  const boardsSnap = await db.collection("boards").get();

  for (const boardDoc of boardsSnap.docs) {
    const boardId = boardDoc.id;
    console.log(`🔍 Checking board: ${boardId}`);

    const imagesSnap = await db
      .collection("boards")
      .doc(boardId)
      .collection("images")
      .get();

    for (const imageDoc of imagesSnap.docs) {
  const data = imageDoc.data();

  if (data.storage?.size || data.size) continue; // skip Supabase + already updated

  try {
    let size;

    if (data.src.startsWith("data:image")) {
      // handle base64 data URI
      const base64 = data.src.split(",")[1]; // strip header
      const buffer = Buffer.from(base64, "base64");
      size = buffer.byteLength;
    } else {
      // normal HTTP(S) URL
      const res = await fetch(data.src);
      const buffer = await res.arrayBuffer();
      size = buffer.byteLength;
    }

    await imageDoc.ref.update({ size });

    console.log(
      `✅ Updated ${boardId}/${imageDoc.id} with size=${(size / (1024 * 1024)).toFixed(2)} MB`
    );
  } catch (err) {
    console.error(`❌ Failed to update ${boardId}/${imageDoc.id}`, err.message);
  }
}

  }

  console.log("🎉 Backfill complete!");
}

backfillImageSizes();
