// Minimal Figma API client — no external dependencies.
// Uses the token from the FIGMA_TOKEN environment variable.

const BASE_URL = "https://api.figma.com/v1";

function getToken() {
  const token = process.env.FIGMA_TOKEN;
  if (!token) {
    throw new Error(
      "FIGMA_TOKEN is not set. Copy .env.example to .env and add your token."
    );
  }
  return token;
}

/**
 * Call any Figma REST endpoint, e.g. "/me" or "/files/:key".
 * Returns the parsed JSON body.
 */
export async function figma(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "X-Figma-Token": getToken(),
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.err || body?.message || res.statusText;
    throw new Error(`Figma API ${res.status}: ${message}`);
  }
  return body;
}

/** Current authenticated user. */
export const getMe = () => figma("/me");

/** A file's full document tree. `key` is the id in the Figma URL. */
export const getFile = (key) => figma(`/files/${key}`);
