/**
 * Merge swagger-mobile.json + swagger-admin.json → swagger.json (legacy / combined export).
 *
 *   npm run swagger:merge
 *
 * Edit the mobile or admin spec when you change routes; run merge if you still need swagger.json.
 */
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');

function readSpec(filename: string) {
  const filePath = path.join(root, filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function mergeSpecs() {
  const mobile = readSpec('swagger-mobile.json');
  const admin = readSpec('swagger-admin.json');

  const merged = {
    openapi: mobile.openapi,
    info: {
      title: 'Jikanzo API',
      description:
        'Combined OpenAPI spec. Prefer swagger-mobile.json or swagger-admin.json for day-to-day docs.',
      version: mobile.info.version,
    },
    servers: mobile.servers,
    components: {
      securitySchemes: mobile.components.securitySchemes,
      schemas: {
        ...mobile.components.schemas,
        ...admin.components.schemas,
      },
    },
    paths: {
      ...mobile.paths,
      ...admin.paths,
    },
  };

  fs.writeFileSync(path.join(root, 'swagger.json'), JSON.stringify(merged, null, 4));
  console.log(
    `swagger.json updated (${Object.keys(merged.paths).length} paths, ${Object.keys(merged.components.schemas).length} schemas)`
  );
}

mergeSpecs();
