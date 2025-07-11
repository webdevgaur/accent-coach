import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { findFirstMismatch } from "./analysis";
import type { AttemptDoc, LessonDoc } from "./models";

const db = getFirestore();

/**
 * Client sends { lessonId }.
 * We return the most recent attempt's score + a tip string.
 */

export const getAttemptResult = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login first");
  const uid = request.auth.uid;
  const lessonId = request.data.lessonId;
  if (!lessonId) throw new HttpsError("invalid-argument", "lessonId required");

  // 1. get latest attempt
  const snap = await db.collection("attempts")
    .doc(uid).collection(lessonId)
    .orderBy("createdAt", "desc").limit(1).get();

  if (snap.empty) return { score: null };

  const attempt = snap.docs[0].data() as AttemptDoc;

  // 2. crude tip: which prompt word diverged first?
  const lessonSnap = await db.doc(`lessons/${lessonId}`).get();
  const lesson = lessonSnap.data() as LessonDoc;
  const badWord = findFirstMismatch(lesson.prompt, attempt.transcript ?? "");

  let tip: string|undefined;
  if (badWord) {
    // micro-heuristic: TH, R/L, V/W, short/long i
    if (/^th/.test(badWord))      tip = `Unvoiced “TH” in “${badWord}” - place tongue between teeth.`;
    else if (/r/.test(badWord))   tip = `Check American R in “${badWord}” - tongue pulled back, no lip rounding.`;
    else if (/v|w/.test(badWord)) tip = `Differentiate V/W - engage lower lip for V in “${badWord}”.`;
    else                          tip = `Focus on the vowel in “${badWord}”.`;
  }

  return { score: attempt.score ?? 0, transcript: attempt.transcript, tip };
});
