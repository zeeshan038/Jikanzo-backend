const fs = require('fs');
const path = require('path');

const swaggerPath = path.join(__dirname, '../swagger.json');
const swaggerData = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));

// 1. Dashboard
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
                status: { type: 'boolean', example: true },
                data: {
                  type: 'object',
                  properties: {
                    walletBalance: { type: 'number', example: 1500.5 },
                    newRequests: {
                      type: 'object',
                      properties: {
                        count: { type: 'integer', example: 5 },
                        list: { type: 'array', items: { type: 'object' } }
                      }
                    },
                    todayBookings: { type: 'array', items: { type: 'object' } },
                    activeBookings: { type: 'integer', example: 2 },
                    profileViews: { type: 'integer', example: 120 },
                    rating: { type: 'number', example: 4.8 },
                    trustRank: { type: 'string', example: 'GOOD' },
                    performances: {
                      type: 'object',
                      properties: {
                        totalSessions: { type: 'integer', example: 45 },
                        repeatClients: { type: 'integer', example: 12 },
                        repeatRate: { type: 'number', example: 26 }
                      }
                    },
                    reviews: { type: 'array', items: { type: 'object' } }
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

// 2. Become Companion
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
                status: { type: 'boolean', example: true },
                msg: { type: 'string', example: 'Successfully became a companion' },
                data: { $ref: '#/components/schemas/UserDto' }
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

// 3. Become Client
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
                status: { type: 'boolean', example: true },
                msg: { type: 'string', example: 'Successfully unlocked client mode' },
                data: { $ref: '#/components/schemas/UserDto' }
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

// 4. Toggle Online Status
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
                status: { type: 'boolean', example: true },
                msg: { type: 'string', example: 'You are now online' },
                data: {
                  type: 'object',
                  properties: {
                    isOnline: { type: 'boolean', example: true }
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

fs.writeFileSync(swaggerPath, JSON.stringify(swaggerData, null, 2));
console.log('Swagger properly populated and updated successfully!');
