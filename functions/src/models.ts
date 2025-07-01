export interface UserDoc {
    email: string;
    displayName: string;
    tier: 'free' | 'plus' | 'pro';
    xp: number;
    streak: number;
    createdAt: number;
    lastLogin?: Date;
    lastActive?: Date;
}

export interface LessonDoc {
    prompt: string;
    audioUrl: string;
    ipa: string;
    targetPhenome: string;
    level: number;
}

export interface AttemptDoc {
    audioPath: string;
    transcript?: string;
    score?: number;
    createdAt: number;
}