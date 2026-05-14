import { SignJWT } from "jose";
import { readFileSync } from "fs";

const env = readFileSync("/home/minchin/NeuroGrid_Project/neurogrid-web-dashboard/.env.local", "utf8");
const secret = env.match(/^JWT_SECRET=(.+)$/m)[1];

const wallet = process.argv[2] || "TestMinerWallet111111111111111111111111111";
const role = process.argv[3] || "miner";

const token = await new SignJWT({ sub: wallet, method: "wallet", role })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("24h")
  .setIssuer("neurogrid")
  .sign(new TextEncoder().encode(secret));

console.log(token);
