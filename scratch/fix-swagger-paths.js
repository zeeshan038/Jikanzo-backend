const fs = require('fs');
const path = require('path');

const swaggerPath = path.join(__dirname, '../swagger.json');
const swaggerData = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));

// Fix paths by removing /user from the companion routes
const routesToFix = [
  '/user/companion/dashboard',
  '/user/companion/become-companion',
  '/user/companion/become-client',
  '/user/companion/toggle-online-status'
];

routesToFix.forEach(oldRoute => {
  if (swaggerData.paths[oldRoute]) {
    const newRoute = oldRoute.replace('/user/companion', '/companion');
    swaggerData.paths[newRoute] = swaggerData.paths[oldRoute];
    delete swaggerData.paths[oldRoute];
  }
});

fs.writeFileSync(swaggerPath, JSON.stringify(swaggerData, null, 2));
console.log('Swagger paths corrected successfully!');
