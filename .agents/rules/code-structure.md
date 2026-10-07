---
trigger: always_on
---

# Code structure and cleanliness

Follow patterns already used in this repo (especially `controllers/admin/auth/admin.js` and `controllers/User/user.js`).

## File layout (controllers)
1. Imports at the top (group: models → npm packages → utils → schemas).
2. Optional small helpers/constants after imports.
3. One exported handler per endpoint, each preceded by the API JSDoc block (see api-route-comments rule).
4. Use named exports: `export const handlerName = async (req, res) => { ... }`.

## Handler shape
- Destructure `req.body` / params at the start when needed.
- Wrap logic in `try/catch`.
- Validate required fields early; return `res.status(4xx).json({ status: false, msg: "..." })`.
- Success: `res.status(2xx).json({ status: true, msg: "...", ...data })`.
- Errors: log with a clear prefix (`console.error("Register Admin Error:", error)`), respond `500` with `{ status: false, msg: "Server error" }` unless the project file already uses `error.message`.

## Clean code
- Minimal diff: do not refactor unrelated code or rename files unless asked.
- No dead code, commented-out blocks, or debug logs left behind.
- Reuse existing utils/models; do not duplicate helpers that already exist under `utils/`.
- Match indentation and quote style of the **file you are editing** (do not reformat the whole file).
- No secrets in code or logs; never commit or reference `.env` values in comments.

## Responses
- Prefer consistent `{ status, msg }` JSON shape used elsewhere in the same controller.
