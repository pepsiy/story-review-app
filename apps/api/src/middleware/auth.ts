import { Request, Response, NextFunction } from 'express';
// Fix relative path
import { db } from "../../../../packages/db/src";
import { sessions } from "../../../../packages/db/src";
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
    user?: {
        id: string;
    };
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Null Token' });
    }

    try {
        const session = await db.query.sessions.findFirst({
            where: eq(sessions.sessionToken, token)
        });

        if (!session || new Date() > session.expires) {
            return res.status(403).json({ error: 'Invalid or Expired Token' });
        }

        (req as any).user = { id: session.userId };
        next();
    } catch (error) {
        console.error("Auth Middleware Error:", error);
        return res.status(500).json({ error: 'Auth Error' });
    }
};
