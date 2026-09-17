const fs = require('fs');
const path = require('path');

const swaggerPath = path.join(__dirname, '../swagger.json');
const swaggerData = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));

const becomeCompanionRoute = swaggerData.paths['/companion/become-companion'];
if (becomeCompanionRoute) {
  becomeCompanionRoute.post.responses['200'] = {
    description: 'Successfully became a companion',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            status: { type: 'boolean', example: true },
            msg: { type: 'string', example: 'Successfully became a companion' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                cloudflareId: { type: 'string' },
                username: { type: 'string' },
                phone: { type: 'string' },
                profileImage: { type: 'string' },
                role: { type: 'string' },
                walletBalance: { type: 'number' },
                about: { type: 'string' },
                languages: { type: 'array', items: { type: 'string' } },
                activityType: { type: 'array', items: { type: 'string' } },
                savedLocations: { type: 'array', items: { type: 'object' } },
                gender: { type: 'string' },
                age: { type: 'integer' },
                gallery: { type: 'array', items: { type: 'string' } },
                intros: { type: 'array', items: { type: 'string' } },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
                currentToken: { type: 'string' },
                fcmToken: { type: 'string', nullable: true }
              }
            }
          }
        },
        example: {
          "status": true,
          "msg": "Successfully became a companion",
          "data": {
              "id": 232,
              "cloudflareId": "0ca3ebff7378",
              "username": "Muhammnad Zeeshan 1",
              "phone": "+919902693",
              "profileImage": "",
              "role": "BOTH",
              "walletBalance": 0,
              "about": "",
              "languages": [],
              "activityType": [],
              "savedLocations": [],
              "gender": "",
              "age": 0,
              "gallery": [],
              "intros": [],
              "createdAt": "2026-09-17T18:44:20.735Z",
              "updatedAt": "2026-09-17T18:49:22.697Z",
              "currentToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiIyMzIiLCJpYXQiOjE3ODk2NzA2NjAsImV4cCI6MTc5MDI3NTQ2MH0.Z_Pv67P0POUsnQuhNz4SzBggMKQnRNF9p1Wy-OFC1tM",
              "fcmToken": null
          }
        }
      }
    }
  };
}

fs.writeFileSync(swaggerPath, JSON.stringify(swaggerData, null, 2));
console.log('Swagger become-companion example updated successfully!');
