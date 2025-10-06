// backfillPicksCount.cjs
const admin = require("firebase-admin");
const fs = require("fs");

const serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function backfillPicksCount() {
  const boardsSnap = await db.collection("boards").get();

  for (const boardDoc of boardsSnap.docs) {
    const boardId = boardDoc.id;
    console.log(`🔍 Checking board: ${boardId}`);

    try {
      const imagesSnap = await db
        .collection("boards")
        .doc(boardId)
        .collection("images")
        .get();

      const picksCount = imagesSnap.size;

      await boardDoc.ref.update({ picksCount });

      console.log(`✅ Board ${boardId} picksCount set to ${picksCount}`);
    } catch (err) {
      console.error(`❌ Failed to update picksCount for board ${boardId}:`, err.message);
    }
  }

  console.log("🎉 Backfill complete!");
}

backfillPicksCount();
