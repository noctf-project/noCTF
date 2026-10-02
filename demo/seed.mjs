const apiUrl = process.env.DEMO_LOCAL_API_URL;
const domain = process.env.DEMO_DOMAIN ?? "demo.noctf.dev";
const rootUrl = process.env.DEMO_ROOT_URL ?? `https://${domain}`;

if (!apiUrl) {
  throw new Error("DEMO_LOCAL_API_URL must be set");
}

class ApiError extends Error {
  constructor(status, message) {
    super(`API request failed (${status}): ${message}`);
    this.status = status;
  }
}

async function request(path, { method = "GET", token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(new URL(path, apiUrl), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.message ?? data.error ?? response.statusText,
    );
  }
  return data;
}

async function waitForApi() {
  console.log(`Waiting for API at ${apiUrl}...`);
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(new URL("/healthz", apiUrl));
      if (response.ok) return;
    } catch {
      // The containers may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`API did not become ready at ${apiUrl}`);
}

async function registerOrLogin(email, name, password) {
  try {
    const session = await request("/auth/email/finish", {
      method: "POST",
      body: { email, password },
    });
    return session.data.token;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }

  const registration = await request("/auth/email/verify", {
    method: "POST",
    body: { email },
  });
  const session = await request("/auth/register/finish", {
    method: "POST",
    body: {
      token: registration.data.token,
      email,
      name,
      password,
    },
  });
  return session.data.token;
}

async function ensurePlayerTeam(playerToken) {
  try {
    const { data: team } = await request("/team", { token: playerToken });
    if (team.name !== "team1") {
      throw new Error(`player1 is already in team ${team.name}`);
    }
    return;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }

  await request("/teams", {
    method: "POST",
    token: playerToken,
    body: { name: "team1", division_id: 1, tag_ids: [] },
  });
}

async function configureDemo(adminToken, adminEmail, playerEmail) {
  const config = await request("/admin/config/core.setup", {
    token: adminToken,
  });
  const startedAt = new Date()
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
  const message = [
    `This demo instance started at approximately ${startedAt} `,
    "and resets every hour.",
    "",
    "Log in with either account:",
    "",
    `- **Admin:** \`${adminEmail}\` / \`password\``,
    `- **Player (team team1):** \`${playerEmail}\` / \`password\``,
  ].join("\n");
  const value = {
    ...config.data.value,
    active: true,
    root_url: rootUrl,
    name: "noCTF Demo",
    message,
  };
  delete value.start_time_s;
  delete value.end_time_s;

  await request("/admin/config/core.setup", {
    method: "PUT",
    token: adminToken,
    body: { version: config.data.version, value },
  });
}

await waitForApi();
console.log("Setting up demo accounts...");

const adminEmail = `admin@${domain}`;
const playerEmail = `player1@${domain}`;
const adminToken = await registerOrLogin(adminEmail, "admin", "password");
const playerToken = await registerOrLogin(playerEmail, "player1", "password");

await ensurePlayerTeam(playerToken);
await configureDemo(adminToken, adminEmail, playerEmail);

console.log(`Demo is ready: ${rootUrl}`);
console.log(
  `API: ${process.env.DEMO_API_BASE_URL} (host port ${process.env.DEMO_API_PORT})`,
);
console.log(`Admin login: ${adminEmail} / password`);
console.log(`Player login: ${playerEmail} / password (team team1)`);
