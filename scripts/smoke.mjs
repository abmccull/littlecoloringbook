import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const webRoot = path.join(repoRoot, "apps", "web");
const port = 3100;
const baseUrl = "http://127.0.0.1:" + port;
const cronSecret = "smoke-secret";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl + "/api/health", { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {
      // ignore boot race
    }
    await sleep(1000);
  }

  throw new Error("Timed out waiting for the dev server to start.");
}

async function getText(pathname) {
  const response = await fetch(baseUrl + pathname, { cache: "no-store" });
  assert(response.ok, "Expected " + pathname + " to return 200, received " + response.status + ".");
  return response.text();
}

async function getJson(pathname, init = {}) {
  const response = await fetch(baseUrl + pathname, { cache: "no-store", ...init });
  const payload = await response.json().catch(() => null);
  assert(response.ok, "Expected " + pathname + " to succeed, received " + response.status + ".");
  return payload;
}

async function postJson(pathname, body, headers = {}) {
  return getJson(pathname, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: webRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    APP_URL: baseUrl,
    CRON_SECRET: cronSecret,
  },
});

try {
  await waitForServer();

  const health = await getJson("/api/health");
  assert(health.ok === true, "Health endpoint did not report ok=true.");

  const home = await getText("/");
  assert(home.includes("Get My Free Sample Page"), "Homepage CTA copy is missing.");

  const sample = await getText("/sample");
  assert(sample.includes("Get a free personalized coloring page to print tonight"), "Sample page headline is missing.");

  const sampleOrder = await postJson("/api/samples", {
    email: "sample-smoke@example.com",
    childFirstName: "Mila",
  });
  assert(typeof sampleOrder.id === "string" && sampleOrder.id.length > 0, "Sample creation did not return an id.");
  assert(typeof sampleOrder.processingUrl === "string" && sampleOrder.processingUrl.length > 0, "Sample creation did not return a processing URL.");

  const sampleProcessingPath = sampleOrder.processingUrl.startsWith("http")
    ? new URL(sampleOrder.processingUrl).pathname + new URL(sampleOrder.processingUrl).search
    : sampleOrder.processingUrl;
  const sampleProcessing = await getText(sampleProcessingPath);
  assert(
    sampleProcessing.includes("Upload the photo you want turned into a coloring page") ||
      sampleProcessing.includes("Your free page is being created") ||
      sampleProcessing.includes("Your free coloring page is ready"),
    "Sample processing flow did not render the updated upload, processing, or ready state.",
  );

  const create = await getText("/create");
  assert(create.includes("Choose your full book"), "Create page headline is missing.");

  const order = await postJson("/api/orders", {
    email: "smoke@example.com",
    orderType: "pdf",
    deliveryMode: "pdf",
    selectedOffer: "pdf-30",
    designCount: 30,
    childFirstName: "Mila",
    dedicationText: "Smoke test order",
  });

  assert(typeof order.id === "string" && order.id.length > 0, "Order creation did not return an id.");
  assert(typeof order.portalUrl === "string" && order.portalUrl.length > 0, "Order creation did not return a portal URL.");

  const portalPath = order.portalUrl.startsWith("http") ? new URL(order.portalUrl).pathname : order.portalUrl;
  const portal = await getText(portalPath);
  assert(portal.includes("Customer portal"), "Portal page did not render.");

  const unauthorizedJobResponse = await fetch(baseUrl + "/api/internal/jobs/process-paid-order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId: order.id }),
  });
  assert(unauthorizedJobResponse.status === 401, "Expected protected internal job route to return 401, received " + unauthorizedJobResponse.status + ".");

  const authorizedJobResponse = await fetch(baseUrl + "/api/internal/jobs/process-paid-order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + cronSecret,
    },
    body: JSON.stringify({ orderId: order.id }),
  });
  assert(authorizedJobResponse.status === 409, "Expected processing route without uploads to return 409, received " + authorizedJobResponse.status + ".");

  const checkout = await postJson("/api/orders/" + order.id + "/checkout", {
    selectedOffer: "pdf-30",
  });
  assert(typeof checkout.checkoutUrl === "string" && checkout.checkoutUrl.length > 0, "Checkout route did not return a checkoutUrl.");

  const confirmation = await getText("/order/confirmation?orderId=" + order.id);
  assert(confirmation.includes("Payment received"), "Confirmation page did not render.");

  const cron = await getJson("/api/cron/lulu-status", {
    headers: {
      Authorization: "Bearer " + cronSecret,
    },
  });
  assert(cron.ok === true, "Cron sync route did not return ok=true.");

  console.log("\nSmoke test passed.");
} finally {
  server.kill("SIGTERM");
  await sleep(1000);
  if (!server.killed) {
    server.kill("SIGKILL");
  }
}
