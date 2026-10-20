const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
});

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Heliobond Backend API",
    version: "1.0.0",
    description:
      "REST API for the Heliobond impact-investment platform. " +
      "All endpoints are available under `/v1`. The unversioned paths " +
      "(`/api/...`) are deprecated and will be removed after 2027-01-01.",
  },
  servers: [
    { url: "/v1", description: "Current (v1)" },
    { url: "/api", description: "Deprecated — use /v1" },
  ],
  components: {
    securitySchemes: {
      UserId: {
        type: "apiKey" as const,
        in: "header",
        name: "X-User-Id",
        description: "Required for admin and role-management endpoints.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
      Project: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          credit_quality: { type: "number" },
          green_impact: { type: "number" },
        },
      },
      ScoreHistory: {
        type: "object",
        properties: {
          project_id: { type: "integer" },
          credit_quality: { type: "number" },
          green_impact: { type: "number" },
          recorded_at: { type: "integer", description: "Unix ms timestamp" },
        },
      },
      Trend: {
        type: "object",
        properties: {
          trend: { type: "string", enum: ["improving", "declining", "stable"] },
          net_delta: { type: "number" },
          data_points: { type: "integer" },
        },
      },
      BatchJob: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: { type: "string", enum: ["pending", "running", "done", "failed"] },
          total: { type: "integer" },
          completed: { type: "integer" },
          failed: { type: "integer" },
          started_at: { type: "integer" },
          finished_at: { type: "integer", nullable: true },
        },
      },
      Role: {
        type: "object",
        properties: {
          userId: { type: "string" },
          role: { type: "string", enum: ["admin", "operator", "viewer"] },
        },
      },
      Webhook: {
        type: "object",
        properties: {
          id: { type: "string" },
          url: { type: "string" },
          secret: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/iot/solar/{projectId}": {
      get: {
        summary: "Get solar data for a project",
        tags: ["IoT"],
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          200: { description: "Solar metrics" },
          400: errorResponse("Bad request"),
          404: errorResponse("Project not found"),
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
    },
    "/iot/satellite/{projectId}": {
      get: {
        summary: "Get satellite data for a project",
        tags: ["IoT"],
        parameters: [
          { name: "projectId", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          200: { description: "Satellite metrics" },
          400: errorResponse("Bad request"),
          404: errorResponse("Project not found"),
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
    },
    "/projects": {
      get: {
        summary: "List all projects",
        tags: ["Projects"],
        responses: {
          200: { description: "Array of projects" },
          500: errorResponse("Internal server error"),
        },
      },
    },
    "/projects/{id}": {
      get: {
        summary: "Get a single project",
        tags: ["Projects"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: {
            description: "Project object",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Project" } } },
          },
          400: errorResponse("Bad request"),
          404: errorResponse("Project not found"),
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
    },
    "/projects/{id}/history": {
      get: {
        summary: "Score history for a project",
        tags: ["History"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
          {
            name: "from",
            in: "query",
            schema: { type: "integer" },
            description: "Start timestamp (ms)",
          },
          {
            name: "to",
            in: "query",
            schema: { type: "integer" },
            description: "End timestamp (ms)",
          },
          { name: "format", in: "query", schema: { type: "string", enum: ["json", "csv"] } },
        ],
        responses: {
          200: { description: "Score history entries or CSV download" },
          400: errorResponse("Bad request"),
          404: errorResponse("Project not found"),
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
    },
    "/projects/{id}/history/trend": {
      get: {
        summary: "Score trend for a project",
        tags: ["History"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: {
            description: "Trend result",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Trend" } } },
          },
          400: errorResponse("Bad request"),
          404: errorResponse("Project not found"),
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
    },
    "/portfolio": {
      get: {
        summary: "Get portfolio summary",
        tags: ["Portfolio"],
        responses: {
          200: { description: "Portfolio metrics" },
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
    },
    "/admin/score-update": {
      post: {
        summary: "Trigger a manual score update",
        tags: ["Admin"],
        security: [{ UserId: [] }],
        responses: {
          200: { description: "Score updated" },
          400: errorResponse("Bad request"),
          401: errorResponse("Unauthorized"),
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
    },
    "/admin/batch/score-update": {
      post: {
        summary: "Enqueue a batch score-update job",
        tags: ["Admin", "Batch"],
        security: [{ UserId: [] }],
        responses: {
          202: {
            description: "Job accepted",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BatchJob" } } },
          },
          400: errorResponse("Bad request"),
          401: errorResponse("Unauthorized"),
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
    },
    "/admin/batch/{batchId}/status": {
      get: {
        summary: "Get batch job status",
        tags: ["Admin", "Batch"],
        security: [{ UserId: [] }],
        parameters: [{ name: "batchId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            description: "Job status",
            content: { "application/json": { schema: { $ref: "#/components/schemas/BatchJob" } } },
          },
          401: errorResponse("Unauthorized"),
          404: errorResponse("Job not found"),
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
    },
    "/roles": {
      get: {
        summary: "List all role assignments",
        tags: ["Roles"],
        security: [{ UserId: [] }],
        responses: {
          200: { description: "Array of role entries" },
          401: errorResponse("Unauthorized"),
          403: errorResponse("Forbidden"),
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
      post: {
        summary: "Assign a role to a user",
        tags: ["Roles"],
        security: [{ UserId: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Role" },
            },
          },
        },
        responses: {
          201: { description: "Role assigned" },
          400: errorResponse("Invalid role"),
          401: errorResponse("Unauthorized"),
          403: errorResponse("Insufficient permissions"),
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
    },
    "/roles/{userId}": {
      delete: {
        summary: "Remove a role from a user",
        tags: ["Roles"],
        security: [{ UserId: [] }],
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Role removed" },
          401: errorResponse("Unauthorized"),
          403: errorResponse("Forbidden"),
          404: errorResponse("User not found"),
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
    },
    "/webhooks": {
      get: {
        summary: "List registered webhooks",
        tags: ["Webhooks"],
        security: [{ UserId: [] }],
        responses: {
          200: { description: "Array of webhook configs" },
          401: errorResponse("Unauthorized"),
          403: errorResponse("Forbidden"),
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
      post: {
        summary: "Register a new webhook",
        tags: ["Webhooks"],
        security: [{ UserId: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url", "secret"],
                properties: {
                  url: { type: "string" },
                  secret: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Webhook registered",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Webhook" } } },
          },
          400: errorResponse("Bad request"),
          401: errorResponse("Unauthorized"),
          403: errorResponse("Forbidden"),
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
    },
    "/webhooks/{id}": {
      get: {
        summary: "Get a webhook by ID",
        tags: ["Webhooks"],
        security: [{ UserId: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Webhook config" },
          401: errorResponse("Unauthorized"),
          404: errorResponse("Webhook not found"),
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
      delete: {
        summary: "Remove a webhook",
        tags: ["Webhooks"],
        security: [{ UserId: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Webhook removed" },
          401: errorResponse("Unauthorized"),
          404: errorResponse("Webhook not found"),
          429: errorResponse("Too many requests"),
          500: errorResponse("Internal server error"),
        },
      },
    },
  },
};
