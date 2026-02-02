// Force dynamic rendering to prevent prerendering errors with auth
export const dynamic = 'force-dynamic';

import GameClient from "./GameClient";

export default function GamePage() {
    return <GameClient />;
}
