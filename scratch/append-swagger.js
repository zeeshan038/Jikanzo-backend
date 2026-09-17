const fs = require('fs');
const path = require('path');

const swaggerPath = path.join(__dirname, '../swagger.json');
const swaggerData = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));

if (!swaggerData.paths['/user/companion/dashboard']) {
  swaggerData.paths['/user/companion/dashboard'] = {
    get: {
      tags: ['Companion'],
      summary: 'Get dashboard data',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Dashboard data retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'boolean' },
                  data: { type: 'object' }
                }
              }
            }
          }
        },
        '404': {
          description: 'Companion profile not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' }
            }
          }
        },
        '500': {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' }
            }
          }
        }
      }
    }
  };
}

if (!swaggerData.paths['/user/companion/become-companion']) {
  swaggerData.paths['/user/companion/become-companion'] = {
    post: {
      tags: ['Companion'],
      summary: 'Initialize Companion Profile and upgrade role to BOTH',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Successfully became a companion',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'boolean' },
                  msg: { type: 'string' },
                  data: { type: 'object' }
                }
              }
            }
          }
        },
        '400': {
          description: 'User is already a companion',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' }
            }
          }
        },
        '404': {
          description: 'User not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' }
            }
          }
        },
        '500': {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' }
            }
          }
        }
      }
    }
  };
}

if (!swaggerData.paths['/user/companion/become-client']) {
  swaggerData.paths['/user/companion/become-client'] = {
    post: {
      tags: ['Companion'],
      summary: 'Upgrade role to BOTH if they registered strictly as COMPANION',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Successfully unlocked client mode',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'boolean' },
                  msg: { type: 'string' },
                  data: { type: 'object' }
                }
              }
            }
          }
        },
        '400': {
          description: 'User already has client access',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' }
            }
          }
        },
        '404': {
          description: 'User not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' }
            }
          }
        },
        '500': {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' }
            }
          }
        }
      }
    }
  };
}

if (!swaggerData.paths['/user/companion/toggle-online-status']) {
  swaggerData.paths['/user/companion/toggle-online-status'] = {
    post: {
      tags: ['Companion'],
      summary: 'Toggle the companion\'s online status',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'Status toggled successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'boolean' },
                  msg: { type: 'string' },
                  data: {
                    type: 'object',
                    properties: {
                      isOnline: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        },
        '404': {
          description: 'Companion profile not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' }
            }
          }
        },
        '500': {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' }
            }
          }
        }
      }
    }
  };
}

fs.writeFileSync(swaggerPath, JSON.stringify(swaggerData, null, 2));
console.log('Swagger updated successfully!');
