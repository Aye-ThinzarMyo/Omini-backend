// test-freepbx.js — project root မှာထားပြီး run: node -r @babel/register test-freepbx.js
import "dotenv/config";
import {
  createFreepbxExtension,
  deleteFreepbxExtension,
} from "./src/services/freepbx";

async function run() {
  console.log("=== Creating test extension ===");
  const result = await createFreepbxExtension({
    name: "Test User",
    email: "test@example.com",
  });
  console.log("Created:", result);

  console.log("\n=== Cleaning up (deleting test extension) ===");
  await deleteFreepbxExtension(result.extensionId);
  console.log("Deleted extension", result.extensionId);
}

run().catch((err) => {
  console.error("FAILED:", err.response?.data || err.message);
});
