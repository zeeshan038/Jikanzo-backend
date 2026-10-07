---
trigger: always_on
---

---
description: Keep OpenAPI specs in sync when adding or changing API endpoints
globs: swagger-mobile.json,swagger-admin.json,swagger.json,src/routes/**/*.ts,src/controllers/**/*.ts
alwaysApply: false
---

# Swagger documentation

OpenAPI is split by client:

| File | Update when |
|------|-------------|
| **`swagger-mobile.json`** | Mobile app routes (`/user`, `/booking`, `/companion`, etc.) |
| **`swagger-admin.json`** | Admin dashboard routes (`/admin/*`) |

Served in `src/index.ts`:

- UI picker: `/swagger` (dropdown: Mobile app / Admin dashboard)
- Mobile only: `/swagger/mobile` → `/swagger-mobile.json`
- Admin only: `/swagger/admin` → `/swagger-admin.json`
- Combined export (legacy): `/swagger.json` — regenerate with `npm run swagger:merge` after editing either spec

Document each endpoint with:

1. **Path & method** — Exact URL and HTTP verb as exposed to clients (paths are relative to `servers[].url`, e.g. `/user/login` under `/api`).
2. **Request body** — Required and optional fields with types (`components.schemas` in the same file).
3. **Success response** — Full JSON shape. **Do not use empty `{}` placeholders**; mirror real fields (`status`, `msg`, `data`, etc.).
4. **Errors** — Status codes the handler can return with representative bodies/messages.

After edits, ensure paths match router mounts in `src/index.ts` and `src/routes/`. Run `npm run swagger:merge` if tools or teammates still rely on `swagger.json`.
