import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import textToSpeech from "@google-cloud/text-to-speech";

initializeApp({ 
  credential: applicationDefault(),
  storageBucket: "accent-coach-dev.firebasestorage.app",
});
const db = getFirestore();
const bucket = getStorage().bucket();
const tts = new textToSpeech.TextToSpeechClient();

(async () => {
  const lessonSnaps = await db.collection("lessons").get();

  for (const docSnap of lessonSnaps.docs) {
    const { prompt, ipa: _ipa, targetPhoneme: _targetPhoneme, level: _level = 1, audioUrl = "" } = docSnap.data();
    const id = docSnap.id;

    if (audioUrl) {
      console.log(`✓ ${id} already has audio, skipping`);
      continue;
    }

    const ttsPath = `tts/${id}.mp3`;
    const file = bucket.file(ttsPath);
    const [exists] = await file.exists();

    if (!exists) {
      const [resp] = await tts.synthesizeSpeech({
        input: { text: prompt },
        voice: { languageCode: "en-US", name: "en-US-Neural2-C" },
        audioConfig: { audioEncoding: "MP3" },
      });
      await file.save(resp.audioContent as Buffer, { contentType: "audio/mpeg" });
      console.log(`🔊  TTS created for ${id}`);
    } else {
      console.log(`ℹ️  ${ttsPath} already in bucket`);
    }

    await docSnap.ref.update({ audioUrl: `gs://${bucket.name}/${ttsPath}` });
    console.log(`✅ Updated Firestore for ${id}`);
  }
})();

