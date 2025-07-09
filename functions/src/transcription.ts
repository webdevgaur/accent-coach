import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { PubSub } from "@google-cloud/pubsub";
import speech from "@google-cloud/speech";
import { LessonDoc, AttemptDoc } from "./models";

const db       = getFirestore();
const storage  = getStorage().bucket();
const pubsub   = new PubSub();
const stt      = new speech.SpeechClient();

/*───────────────────────────────────────────────────────────*
 * 1)  onFinalize → push to transcribe-audio
 *───────────────────────────────────────────────────────────*/
export const enqueueTranscription = onObjectFinalized(
  { bucket: process.env.STORAGE_BUCKET },              // default bucket
  async (event) => {
    const { name, contentType } = event.data;
    // ignore non-raw or unsupported files
    if (!name?.startsWith("raw/") ||
        !(contentType === "audio/webm" || contentType === "audio/wav")) return;

    console.log("enqueueing", name);
    await pubsub
      .topic("transcribe-audio")
      .publishMessage({ attributes: { objectPath: name, contentType } });
  }
);

/*───────────────────────────────────────────────────────────*
 * 2)  Subscriber → download → STT → score → write Firestore
 *───────────────────────────────────────────────────────────*/
export const transcribeAudio = onMessagePublished(
  { topic: "transcribe-audio", region: "us-central1" },
  async (event) => {
    const objectPath  = event.data.message.attributes?.objectPath!;
    const contentType = event.data.message.attributes?.contentType!;
    const [, uid, lessonId, filename] = objectPath.split("/");

    // 2-a) download to /tmp
    const tmp = `/tmp/${filename}`;
    await storage.file(objectPath).download({ destination: tmp });

    // 2-b) run STT
    const [resp] = await stt.recognize({
      audio: { content: (await import("fs")).readFileSync(tmp).toString("base64") },
      config: {
        languageCode: "en-US",
        enableAutomaticPunctuation: true,
        encoding: contentType === "audio/webm" ? "WEBM_OPUS" : "LINEAR16",
        sampleRateHertz: 48000,
      },
    });
    const transcript =
      resp.results?.map(r => r.alternatives?.[0].transcript).join(" ") ?? "";

    // 2-c) compute crude word-accuracy vs. lesson prompt
    const lessonSnap = await db.doc(`lessons/${lessonId}`).get();
    const lesson = lessonSnap.data() as LessonDoc;
    const score = wordAccuracy(lesson.prompt, transcript);

    // 2-d) write attempts/{uid}/{lessonId}/{ts}
    const ts = parseInt(filename.split("-")[0]);       // first segment = Date.now()
    const attempt: AttemptDoc = {
      audioPath: objectPath,
      transcript,
      score,
      createdAt: ts,
    };
    await db.collection("attempts")
            .doc(uid).collection(lessonId)
            .doc(ts.toString())
            .set(attempt);

    console.log(`Transcribed ${objectPath} → score ${score}%`);
  }
);

/*───────────────────────────────────────────────────────────*
 * 3)  Helper: word-level accuracy  (Levenshtein distance)
 *───────────────────────────────────────────────────────────*/
function wordAccuracy(expected: string, actual: string): number {
  const a = expected.toLowerCase().split(/\s+/);
  const b = actual.toLowerCase().split(/\s+/);
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  const edits = dp[m][n];
  return Math.max(0, Math.round(100 * (1 - edits / m)));
}
