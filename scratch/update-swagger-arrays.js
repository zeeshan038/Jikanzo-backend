const fs = require('fs');
const path = require('path');

const swaggerPath = path.join(__dirname, '../swagger.json');
const swaggerData = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));

const clientSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    username: { type: 'string', example: 'client123' },
    profileImage: { type: 'string', example: 'https://example.com/pic.jpg' }
  }
};

const bookingSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 101 },
    date: { type: 'string', format: 'date-time' },
    startTime: { type: 'string', format: 'date-time' },
    endTime: { type: 'string', format: 'date-time' },
    status: { type: 'string', example: 'PENDING' },
    clientId: { type: 'integer', example: 1 },
    companionId: { type: 'integer', example: 2 },
    client: clientSchema
  }
};

const reviewSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 50 },
    rating: { type: 'number', example: 4.5 },
    comment: { type: 'string', example: 'Great time!' },
    createdAt: { type: 'string', format: 'date-time' },
    client: clientSchema
  }
};

swaggerData.paths['/user/companion/dashboard'].get.responses['200'].content['application/json'].schema.properties.data.properties.newRequests.properties.list.items = bookingSchema;
swaggerData.paths['/user/companion/dashboard'].get.responses['200'].content['application/json'].schema.properties.data.properties.todayBookings.items = bookingSchema;
swaggerData.paths['/user/companion/dashboard'].get.responses['200'].content['application/json'].schema.properties.data.properties.reviews.items = reviewSchema;

fs.writeFileSync(swaggerPath, JSON.stringify(swaggerData, null, 2));
console.log('Swagger dashboard array schemas updated successfully!');
