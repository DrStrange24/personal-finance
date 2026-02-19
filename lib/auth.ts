import jwt from "jsonwebtoken";

type SessionPayload = {
    userId: string;
    email: string;
};

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not set");
    }
    return secret;
};

export const signSessionToken = (payload: SessionPayload) => {
    return jwt.sign({ sub: payload.userId, email: payload.email }, getJwtSecret(), {
        expiresIn: "7d",
    });
};

export const verifySessionToken = (token: string): SessionPayload | null => {
    try {
        const decoded = jwt.verify(token, getJwtSecret());

        if (
            typeof decoded === "object" &&
            decoded !== null &&
            typeof decoded.sub === "string" &&
            typeof decoded.email === "string"
        ) {
            return {
                userId: decoded.sub,
                email: decoded.email,
            };
        }
    } catch {
        return null;
    }

    return null;
};
