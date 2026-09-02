const fs = require('fs');

const swaggerPath = './swagger.json';
const swaggerDoc = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));

// Add Schemas
swaggerDoc.components.schemas.UpdateProfileRequest = {
  type: 'object',
  properties: {
    about: { type: 'string' },
    languages: { type: 'array', items: { type: 'string' } },
    activityType: { type: 'array', items: { type: 'string' } },
    savedLocations: { type: 'array', items: { type: 'object' } },
    gender: { type: 'string' },
    age: { type: 'integer' },
    username: { type: 'string', minLength: 3, maxLength: 30 },
    profileImage: { type: 'string', format: 'uri' }
  }
};

swaggerDoc.components.schemas.CreateBookingRequest = {
  type: 'object',
  required: ['date', 'startTime', 'endTime'],
  properties: {
    date: { type: 'string', format: 'date-time' },
    startTime: { type: 'string', format: 'date-time' },
    endTime: { type: 'string', format: 'date-time' }
  }
};

swaggerDoc.components.schemas.AcceptBookingRequest = {
  type: 'object',
  required: ['bookingId', 'action'],
  properties: {
    bookingId: { type: 'integer' },
    action: { type: 'string', enum: ['ACCEPT', 'DECLINE'] }
  }
};

swaggerDoc.components.schemas.PayWithWalletRequest = {
  type: 'object',
  required: ['bookingId'],
  properties: {
    bookingId: { type: 'integer' }
  }
};

// Add Paths
swaggerDoc.paths['/user/update-profile'] = {
  put: {
    tags: ['User'],
    summary: 'Update user profile',
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/UpdateProfileRequest' }
        }
      }
    },
    responses: {
      '200': { description: 'Profile updated successfully' },
      '400': { description: 'Validation Error' },
      '500': { description: 'Internal Server Error' }
    }
  }
};

swaggerDoc.paths['/user/whoami'] = {
  get: {
    tags: ['User'],
    summary: 'Get current logged in user details',
    security: [{ bearerAuth: [] }],
    responses: {
      '200': { description: 'User details fetched successfully' },
      '404': { description: 'User not found' },
      '500': { description: 'Internal Server Error' }
    }
  }
};

swaggerDoc.paths['/booking/book-companion/{id}'] = {
  post: {
    tags: ['Booking'],
    summary: 'Book a companion',
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'integer' }
      }
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateBookingRequest' }
        }
      }
    },
    responses: {
      '201': { description: 'Booking created successfully' },
      '400': { description: 'Validation Error' },
      '404': { description: 'Companion not found' },
      '500': { description: 'Internal Server Error' }
    }
  }
};

swaggerDoc.paths['/booking/accept'] = {
  post: {
    tags: ['Booking'],
    summary: 'Accept or decline a booking',
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/AcceptBookingRequest' }
        }
      }
    },
    responses: {
      '200': { description: 'Booking status updated successfully' },
      '400': { description: 'Validation Error' },
      '404': { description: 'Booking not found' },
      '500': { description: 'Internal Server Error' }
    }
  }
};

swaggerDoc.paths['/booking/pay-with-wallet'] = {
  post: {
    tags: ['Booking'],
    summary: 'Pay for a booking with wallet balance',
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/PayWithWalletRequest' }
        }
      }
    },
    responses: {
      '200': { description: 'Payment successful' },
      '400': { description: 'Validation Error or Insufficient funds' },
      '404': { description: 'Booking not found' },
      '500': { description: 'Internal Server Error' }
    }
  }
};

fs.writeFileSync(swaggerPath, JSON.stringify(swaggerDoc, null, 2), 'utf8');
console.log('Swagger updated successfully!');
