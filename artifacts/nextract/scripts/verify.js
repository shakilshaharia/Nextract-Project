// Verifies the Figma connection. Run with: npm run verify
import { getMe } from "./figma.js";

// Load .env (Node 20.6+). Ignore if the file is absent — the token may
// already be in the environment.
try {
  process.loadEnvFile();
} catch {
  /* no .env file; rely on process.env */
}

try {
  const me = await getMe();
  console.log("✅ Connected to Figma as:");
  console.log(`   ${me.handle} <${me.email}>`);
} catch (err) {
  console.error("❌ Connection failed:", err.message);
  process.exit(1);
}
