import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getStorage} from "firebase-admin/storage";
import {v4 as uuidv4} from "uuid";

interface Req { lessonId: string }

import { CallableRequest } from "firebase-functions/v2/https";

export const getUploadUrl = onCall<Req>(async (request: CallableRequest<Req>) => {
  // ───────────────── auth & data guards ─────────────────
  if (!request.auth) throw new HttpsError("unauthenticated", "Login first");
  if (!request.data.lessonId) throw new HttpsError("invalid-argument", "lessonId required");

  const uid = request.auth.uid;
  const lessonId = request.data.lessonId;
  const ts = Date.now();
  const fileName = `${ts}-${uuidv4()}.webm`;
  const objectPath = `raw/${uid}/${lessonId}/${fileName}`;

  const bucket = getStorage().bucket();
  try {
    const [url] = await bucket.file(objectPath).getSignedUrl({
    version: "v4",
    action:  "write",
    expires: ts + 15 * 60 * 1000,
    contentType: "audio/webm",
    // virtualHostedStyle: true,
    });

    return {
      url,
      objectPath,
      expires: new Date(ts + 15 * 60 * 1000).toISOString()
    };
  } catch(err) {
    console.error("Failed to generate signed URL", err);
    throw new HttpsError("internal", "Failed to generate signed URL");
  }
});
