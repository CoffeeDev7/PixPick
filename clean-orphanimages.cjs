// ONE TIME SCRIPT TO DELETE ORPHAN IMAGES IN FIRESTORE
const admin = require("firebase-admin");
const fs = require("fs/promises");

const serviceAccount = require("./service-accoun-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteOrphanImages() {
  console.log("🔍 Scanning for orphaned image subcollections...");

  const boardsSnapshot = await db.collection("boards").listDocuments();
  let totalDeleted = 0;

  for (const boardRef of boardsSnapshot) {
    const boardId = boardRef.id;

    try {
      const docSnap = await boardRef.get();

      if (!docSnap.exists) {
        const imagesRef = db.collection(`boards/${boardId}/images`);
        const imagesSnap = await imagesRef.get();

        if (!imagesSnap.empty) {
          console.log(`🧹 Deleting ${imagesSnap.size} images under orphan board ${boardId}`);
          
          const batch = db.batch();
          imagesSnap.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();

          totalDeleted += imagesSnap.size;
        }
      }
    } catch (err) {
      console.error(`❌ Error processing board ${boardId}:`, err);
    }
  }

  console.log(`✅ Done. Deleted ${totalDeleted} orphan image(s).`);
}

deleteOrphanImages();
