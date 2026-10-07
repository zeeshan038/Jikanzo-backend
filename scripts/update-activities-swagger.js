const fs = require('fs');

const adminSwaggerPath = './swagger-admin.json';
const mobileSwaggerPath = './swagger-mobile.json';

const adminDoc = JSON.parse(fs.readFileSync(adminSwaggerPath, 'utf8'));
const mobileDoc = JSON.parse(fs.readFileSync(mobileSwaggerPath, 'utf8'));

// Common Schemas
const ActivityInput = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    image: { type: 'string' },
    isActive: { type: 'boolean' }
  }
};

const SubActivityInput = {
  type: 'object',
  properties: {
    activityId: { type: 'integer' },
    name: { type: 'string' },
    description: { type: 'string' },
    isActive: { type: 'boolean' }
  }
};

const SetCompanionActivitiesInput = {
  type: 'object',
  properties: {
    activities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          activityId: { type: 'integer' },
          price: { type: 'number' },
          isActive: { type: 'boolean' },
          subActivityIds: {
            type: 'array',
            items: { type: 'integer' }
          }
        }
      }
    }
  }
};

// Response Schemas
const BaseErrorResponse = {
  type: 'object',
  properties: {
    status: { type: 'boolean', example: false },
    msg: { type: 'string', example: 'Server error or specific error message' }
  }
};

const ActivityModel = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    name: { type: 'string', example: 'Coffee Meetups' },
    description: { type: 'string', example: 'Relaxing coffee meetup' },
    image: { type: 'string', nullable: true },
    isActive: { type: 'boolean', example: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
};

const SubActivityModel = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    activityId: { type: 'integer', example: 1 },
    name: { type: 'string', example: 'Coffee Cafe' },
    description: { type: 'string', example: 'Coffee Cafe' },
    isActive: { type: 'boolean', example: true }
  }
};

const ActivityWithSubActivitiesModel = {
  allOf: [
    { $ref: '#/components/schemas/ActivityModel' },
    {
      type: 'object',
      properties: {
        subActivities: {
          type: 'array',
          items: { $ref: '#/components/schemas/SubActivityModel' }
        }
      }
    }
  ]
};

const CompanionActivityModel = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    companionId: { type: 'integer', example: 2 },
    activityId: { type: 'integer', example: 1 },
    price: { type: 'number', example: 1500 },
    isActive: { type: 'boolean', example: true },
    activity: { $ref: '#/components/schemas/ActivityModel' },
    subActivities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          companionActivityId: { type: 'integer' },
          subActivityId: { type: 'integer' },
          subActivity: { $ref: '#/components/schemas/SubActivityModel' }
        }
      }
    }
  }
};


// Inject Schemas into Admin Doc
adminDoc.components = adminDoc.components || { schemas: {} };
adminDoc.components.schemas = adminDoc.components.schemas || {};
adminDoc.components.schemas.ActivityInput = ActivityInput;
adminDoc.components.schemas.SubActivityInput = SubActivityInput;
adminDoc.components.schemas.ActivityModel = ActivityModel;
adminDoc.components.schemas.SubActivityModel = SubActivityModel;
adminDoc.components.schemas.ActivityWithSubActivitiesModel = ActivityWithSubActivitiesModel;
adminDoc.components.schemas.BaseErrorResponse = BaseErrorResponse;

adminDoc.paths = adminDoc.paths || {};

adminDoc.paths['/api/admin/activity'] = {
  post: {
    tags: ['Activity'],
    summary: 'Create activity',
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ActivityInput' } } }
    },
    responses: {
      '201': {
        description: 'Activity created successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'boolean', example: true },
                msg: { type: 'string', example: 'Activity created successfully' },
                data: { $ref: '#/components/schemas/ActivityModel' }
              }
            }
          }
        }
      },
      '400': { description: 'Bad Request', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
      '500': { description: 'Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } }
    }
  },
  get: {
    tags: ['Activity'],
    summary: 'Get all activities',
    security: [{ bearerAuth: [] }],
    responses: {
      '200': {
        description: 'Activities fetched successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'boolean', example: true },
                msg: { type: 'string', example: 'Activities fetched successfully' },
                data: { type: 'array', items: { $ref: '#/components/schemas/ActivityWithSubActivitiesModel' } }
              }
            }
          }
        }
      },
      '500': { description: 'Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } }
    }
  }
};

adminDoc.paths['/api/admin/activity/{id}'] = {
  put: {
    tags: ['Activity'],
    summary: 'Update activity',
    security: [{ bearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ActivityInput' } } }
    },
    responses: {
      '200': {
        description: 'Activity updated successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'boolean', example: true },
                msg: { type: 'string', example: 'Activity updated successfully' },
                data: { $ref: '#/components/schemas/ActivityModel' }
              }
            }
          }
        }
      },
      '400': { description: 'Bad Request', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
      '500': { description: 'Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } }
    }
  },
  delete: {
    tags: ['Activity'],
    summary: 'Delete activity',
    security: [{ bearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
    responses: {
      '200': {
        description: 'Activity deleted successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'boolean', example: true },
                msg: { type: 'string', example: 'Activity deleted successfully' }
              }
            }
          }
        }
      },
      '400': { description: 'Bad Request', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
      '500': { description: 'Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } }
    }
  }
};

adminDoc.paths['/api/admin/sub-activity'] = {
  post: {
    tags: ['Activity'],
    summary: 'Create sub-activity',
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/SubActivityInput' } } }
    },
    responses: {
      '201': {
        description: 'Sub-activity created successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'boolean', example: true },
                msg: { type: 'string', example: 'Sub-activity created successfully' },
                data: { $ref: '#/components/schemas/SubActivityModel' }
              }
            }
          }
        }
      },
      '400': { description: 'Bad Request', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
      '500': { description: 'Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } }
    }
  }
};

adminDoc.paths['/api/admin/sub-activity/{id}'] = {
  put: {
    tags: ['Activity'],
    summary: 'Update sub-activity',
    security: [{ bearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/SubActivityInput' } } }
    },
    responses: {
      '200': {
        description: 'Sub-activity updated successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'boolean', example: true },
                msg: { type: 'string', example: 'Sub-activity updated successfully' },
                data: { $ref: '#/components/schemas/SubActivityModel' }
              }
            }
          }
        }
      },
      '400': { description: 'Bad Request', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
      '500': { description: 'Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } }
    }
  },
  delete: {
    tags: ['Activity'],
    summary: 'Delete sub-activity',
    security: [{ bearerAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
    responses: {
      '200': {
        description: 'Sub-activity deleted successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'boolean', example: true },
                msg: { type: 'string', example: 'Sub-activity deleted successfully' }
              }
            }
          }
        }
      },
      '400': { description: 'Bad Request', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
      '500': { description: 'Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } }
    }
  }
};


// Inject Schemas into Mobile Doc
mobileDoc.components = mobileDoc.components || { schemas: {} };
mobileDoc.components.schemas = mobileDoc.components.schemas || {};
mobileDoc.components.schemas.SetCompanionActivitiesInput = SetCompanionActivitiesInput;
mobileDoc.components.schemas.ActivityModel = ActivityModel;
mobileDoc.components.schemas.SubActivityModel = SubActivityModel;
mobileDoc.components.schemas.ActivityWithSubActivitiesModel = ActivityWithSubActivitiesModel;
mobileDoc.components.schemas.CompanionActivityModel = CompanionActivityModel;
mobileDoc.components.schemas.BaseErrorResponse = BaseErrorResponse;

mobileDoc.paths = mobileDoc.paths || {};

mobileDoc.paths['/api/companion/activity/available'] = {
  get: {
    tags: ['Companion Profile'],
    summary: 'Get available activities',
    security: [{ bearerAuth: [] }],
    responses: {
      '200': {
        description: 'Available activities fetched successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'boolean', example: true },
                msg: { type: 'string', example: 'Available activities fetched successfully' },
                data: { type: 'array', items: { $ref: '#/components/schemas/ActivityWithSubActivitiesModel' } }
              }
            }
          }
        }
      },
      '500': { description: 'Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } }
    }
  }
};

mobileDoc.paths['/api/companion/activity'] = {
  get: {
    tags: ['Companion Profile'],
    summary: 'Get companion\'s selected activities',
    security: [{ bearerAuth: [] }],
    responses: {
      '200': {
        description: 'Companion activities fetched successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'boolean', example: true },
                msg: { type: 'string', example: 'Companion activities fetched successfully' },
                data: { type: 'array', items: { $ref: '#/components/schemas/CompanionActivityModel' } }
              }
            }
          }
        }
      },
      '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
      '500': { description: 'Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } }
    }
  },
  put: {
    tags: ['Companion Profile'],
    summary: 'Update companion activities',
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/SetCompanionActivitiesInput' } } }
    },
    responses: {
      '200': {
        description: 'Activities updated successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'boolean', example: true },
                msg: { type: 'string', example: 'Activities updated successfully' }
              }
            }
          }
        }
      },
      '400': { description: 'Bad Request', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
      '404': { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } },
      '500': { description: 'Server Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaseErrorResponse' } } } }
    }
  }
};

fs.writeFileSync(adminSwaggerPath, JSON.stringify(adminDoc, null, 2), 'utf8');
fs.writeFileSync(mobileSwaggerPath, JSON.stringify(mobileDoc, null, 2), 'utf8');

console.log('Activity routes successfully added to swagger-admin.json and swagger-mobile.json with precise schemas!');
