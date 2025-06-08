const admin = require('firebase-admin');
const fetch = require('node-fetch');

const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

function makeFirestoreSafe(str) {
  return str.replace(/[.#$/[\]]/g, '_');
}

(async () => {
  const db = admin.firestore();
  const snapshot = await db.collection('price_watch_list').get();

  for (const doc of snapshot.docs) {
    const name = doc.data().name;
    const safeName = makeFirestoreSafe(name);

    try {
      const res = await fetch(`https://naver-price-api.onrender.com/naver?query=${encodeURIComponent(name)}`);
      const data = await res.json();
      const price = data.price;

      await db.collection('price_history').doc(safeName).set({ name }, { merge: true });
      await db.collection('price_history').doc(safeName).collection('prices').add({
        price,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        source: "naver",
      });

      await db.collection('price_watch_list').doc(safeName).update({
        lastChecked: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`${name} 가격 저장 완료: ${price}`);
    } catch (err) {
      console.error(`${name} 가격 추적 실패:`, err);
    }
  }
})();
