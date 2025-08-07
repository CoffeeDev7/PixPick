const admin = require("firebase-admin");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

// Initialize Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(require("./secure-key.json"))
});

const db = getFirestore();

const usersToInsert = [
  {
    uid: "KYzq6q8TFIfosSEw81NeLeliFrB2",
    email: "kssubash1402@gmail.com",
    createdAt: "2025-08-06"
  },
  {
    uid: "98pzx0xmL4eTx9cxKq6XEbqZApB2",
    email: "anybodycandance787@gmail.com",
    createdAt: "2025-08-05"
  },
  {
    uid: "t3McPNYBGFRoPm7K9m2uNpPRaSM2",
    email: "124004423@sastra.ac.in",
    createdAt: "2025-08-05"
  },
  {
    uid: "2nnEP9YsGxQHqRoHv05RrDUkTr93",
    email: "satyakarthik2020@gmail.com",
    createdAt: "2025-08-03"
  },
  {
    uid: "Fq82YVljwbMw5xAtInOlZdWzh4o1",
    email: "coffeescripted@gmail.com",
    createdAt: "2025-08-03"
  }
];

(async () => {
  for (const user of usersToInsert) {
    const userRef = db.collection("users").doc(user.uid);
    const snapshot = await userRef.get();

    if (snapshot.exists) {
      console.log(`User ${user.uid} already exists, skipping...`);
      continue;
    }

    await userRef.set({
      email: user.email,
      createdAt: Timestamp.fromDate(new Date(user.createdAt)),
      updatedAt: Timestamp.now()
    });

    console.log(`Inserted user: ${user.uid}`);
  }

  console.log("✅ All users processed.");
})();
