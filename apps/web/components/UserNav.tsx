
import { auth, signIn, signOut } from "@/auth"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { UserNavClient } from "./UserNavClient"

export default async function UserNav() {
    const session = await auth()

    if (!session?.user) {
        return (
            <form
                action={async () => {
                    "use server"
                    await signIn("google")
                }}
            >
                <Button variant="outline" type="submit" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold px-6">
                    Đăng nhập
                </Button>
            </form>
        )
    }

    return (
        <UserNavClient
            user={session.user}
            signOutAction={async () => {
                "use server"
                await signOut()
            }}
        />
    )
}
