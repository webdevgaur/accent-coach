import * as functions from "firebase-functions/v1";
import { getFirestore } from "firebase-admin/firestore";
import { UserDoc } from "./models";

const db = getFirestore();

export const newUserSignup = functions.auth.user().onCreate(async (user: any) => {
    if (!user) {
    throw new Error('User data is undefined.');
    }
    const profile: UserDoc = {
        email: user.email ?? '',
        displayName: user.displayName ?? '',
        tier: 'free',
        xp: 0,
        streak: 0,
        createdAt: Date.now()
    };
    await db.doc(`users/${user.uid}`).set(profile);
    console.log("New user signed up:", user.email);

});