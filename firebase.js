const admin = require("firebase-admin");
const { cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccount.json");

admin.initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "pass-generator-8558c.appspot.com",
});

const db = getFirestore();
const storage = admin.storage().bucket();
module.exports = { db, storage };
