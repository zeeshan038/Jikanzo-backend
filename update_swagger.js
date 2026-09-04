const fs = require('fs');
const swagger = JSON.parse(fs.readFileSync('swagger.json', 'utf8'));

// Add Schemas
swagger.components.schemas.SaveCompanionRequest = {
  type: "object",
  required: ["companionId"],
  properties: {
    companionId: { type: "integer" }
  }
};

swagger.components.schemas.CreateMomentRequest = {
  type: "object",
  required: ["mediaUrl"],
  properties: {
    mediaUrl: { type: "string", format: "uri" },
    caption: { type: "string" }
  }
};

// Add Paths
swagger.paths["/feed/save-companion"] = {
  post: {
    tags: ["Feed"],
    summary: "Toggle saving a companion",
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/SaveCompanionRequest" }
        }
      }
    },
    responses: {
      "200": { description: "Companion saved/unsaved successfully" },
      "400": { description: "Validation Error" },
      "404": { description: "Companion not found" },
      "500": { description: "Internal Server Error" }
    }
  }
};

swagger.paths["/feed/saved-companions"] = {
  get: {
    tags: ["Feed"],
    summary: "Get all saved companions for the user",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": { description: "Fetched successfully" },
      "500": { description: "Internal Server Error" }
    }
  }
};

swagger.paths["/moments/create"] = {
  post: {
    tags: ["Moments"],
    summary: "Create a new moment (Story)",
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/CreateMomentRequest" }
        }
      }
    },
    responses: {
      "201": { description: "Moment created successfully" },
      "400": { description: "Validation Error" },
      "403": { description: "Unauthorized - Only companions can create moments" },
      "500": { description: "Internal Server Error" }
    }
  }
};

swagger.paths["/moments/feed"] = {
  get: {
    tags: ["Moments"],
    summary: "Get active moments feed",
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: "type", in: "query", required: false, schema: { type: "string", enum: ["saved", "nearby"] } },
      { name: "lat", in: "query", required: false, schema: { type: "number" } },
      { name: "lng", in: "query", required: false, schema: { type: "number" } },
      { name: "radius", in: "query", required: false, schema: { type: "number" } }
    ],
    responses: {
      "200": { description: "Fetched successfully" },
      "500": { description: "Internal Server Error" }
    }
  }
};

swagger.paths["/moments/{id}"] = {
  delete: {
    tags: ["Moments"],
    summary: "Delete a moment",
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer" } }
    ],
    responses: {
      "200": { description: "Moment deleted successfully" },
      "403": { description: "Unauthorized" },
      "404": { description: "Moment not found" },
      "500": { description: "Internal Server Error" }
    }
  }
};

fs.writeFileSync('swagger.json', JSON.stringify(swagger, null, 2));
console.log("Updated swagger.json");
