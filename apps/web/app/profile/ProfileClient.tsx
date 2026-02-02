// Force dynamic rendering to prevent prerendering errors with auth/headers
export const dynamic = 'force-dynamic';

import ProfileClient from "./ProfileClient";

export default function Page() {
    return <ProfileClient />;
}
