import arcjet, { tokenBucket } from "@arcjet/next";

const hasArcjetKey = Boolean(process.env.ARCJET_KEY);

const aj = hasArcjetKey
  ? arcjet({
      key: process.env.ARCJET_KEY,
      characteristics: ["userId"], // Track based on Clerk userId
      rules: [
        // Rate limiting specifically for collection creation
        tokenBucket({
          mode: "LIVE",
          refillRate: 10, // 10 collections
          interval: 3600, // per hour
          capacity: 10, // maximum burst capacity
        }),
      ],
    })
  : {
      protect: async () => ({
        isDenied: () => false,
      }),
    };

export default aj;
