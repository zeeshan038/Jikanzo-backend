const fs = require('fs');
const path = require('path');

const swaggerPath = path.join(__dirname, '../swagger.json');
const swaggerData = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));

const becomeClientRoute = swaggerData.paths['/companion/become-client'];
if (becomeClientRoute) {
  becomeClientRoute.post.responses['200'] = {
    description: 'Successfully unlocked client mode',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            status: { type: 'boolean', example: true },
            msg: { type: 'string', example: 'Successfully unlocked client mode' },
            data: {
              type: 'object',
              properties: {
                role: { type: 'string' },
                currentToken: { type: 'string' }
              }
            }
          }
        },
        example: {
          "status": true,
          "msg": "Successfully unlocked client mode",
          "data": {
              "role": "BOTH",
              "currentToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiIyMzIiLCJpYXQiOjE3ODk2NzA2NjAsImV4cCI6MTc5MDI3NTQ2MH0.Z_Pv67P0POUsnQuhNz4SzBggMKQnRNF9p1Wy-OFC1tM"
          }
        }
      }
    }
  };
}

fs.writeFileSync(swaggerPath, JSON.stringify(swaggerData, null, 2));
console.log('Swagger become-client example updated to simplified version successfully!');
