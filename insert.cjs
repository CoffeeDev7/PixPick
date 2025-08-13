// insert.cjs
const admin = require("firebase-admin");
const fs = require("fs");

const serviceAccount = JSON.parse(fs.readFileSync("./secret-account-key.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateCollaborators() {
  const boardsSnap = await db.collection("boards").get();

  for (const boardDoc of boardsSnap.docs) {
    const boardData = boardDoc.data();
    const collabsSnap = await db
      .collection("boards")
      .doc(boardDoc.id)
      .collection("collaborators")
      .get();

    for (const collabDoc of collabsSnap.docs) {
      const collabData = collabDoc.data();
      let updates = {};

      // add missing boardId
      if (!("boardId" in collabData) || !collabData.boardId) {
        updates.boardId = boardDoc.id;
      }

      if (!collabData.createdAt) {
        updates.createdAt = admin.firestore.FieldValue.serverTimestamp();
      }
      if (!collabData.boardTitle) {
        updates.boardTitle = boardData.title || "";
      }
      if (!collabData.ownerId) {
        updates.ownerId = boardData.ownerId || "";
      }

      if (Object.keys(updates).length) {
        console.log(`Updating collab in board ${boardDoc.id}:`, updates);
        await collabDoc.ref.update(updates);
      }
    }
  }

  console.log("Migration complete!");
}

migrateCollaborators();
