import {onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

/** Input payload for registration */
interface RegisterData {
  email: string;
  password: string;
  displayName?: string;
}

/**
 * registerUser
 * Creates a Firebase user record and returns the new uid.
 * Callable only from authenticated *admin* clients later,
 * but for now we allow unauthenticated so you can call from Postman.
 */
export const registerUser = onCall<RegisterData>(async (data, context) => {
  // tiny payload validation
  if (!data.data.email || !data.data.password) {
    throw new HttpsError("invalid-argument", "Email & password required");
  }
  try {
    const user = await admin.auth().createUser({
      email: data.data.email,
      password: data.data.password,
      displayName: data.data.displayName ?? undefined,
    }); // :contentReference[oaicite:1]{index=1}
    return {uid: user.uid};
  } catch (err: any) {
    // Map admin errors to callable-friendly codes
    throw new HttpsError("already-exists", err.message);
  }
});


/**
 * verifyToken
 * Example secured endpoint: echoes user uid after verifying ID token.
 */

export const verifyToken = onCall<{}>(async (request: CallableRequest<{}>): Promise<{uid: string}> => {
  if (!request?.auth) {
    throw new HttpsError("unauthenticated", "Login required");
  }
  return {uid: request.auth.uid};
});