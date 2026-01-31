
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@repo/db"

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: DrizzleAdapter(db),
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID || "placeholder_id",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder_secret",
        }),
    ],
    callbacks: {
        session: ({ session, user }) => {
            // Add user ID to session
            if (session.user) {
                session.user.id = user.id;
            }
            return session;
        },
    },
})
