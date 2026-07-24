"use client";

import { createAuthClient } from "better-auth/react";
import { appUrl } from "./env";

export const authClient = createAuthClient({ baseURL: appUrl });

export const { signIn, signUp, signOut, useSession } = authClient;
