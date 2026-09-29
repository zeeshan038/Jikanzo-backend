//NPM Packages
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
dotenv.config();

//Config
import prisma from './config/db';
import './config/firebase';

//Paths
import routes from './routes/user/index';
import './cron/booking';
import { initSockets } from './sockets';

const app = express();

// Prisma client is instantiated in db.ts and can be used directly.
prisma.$connect()
  .then(() => console.log('Successfully connected to the database!'))
  .catch((e) => console.error('Failed to connect to the database:', e));

//Middlewares
app.use(cors());

// Mount stripe webhook BEFORE express.json() so it can access the raw body for signature verification
import { stripeWebhook } from './controllers/user/stripe';
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json());

// Swagger Setup (mobile + admin specs at repo root)
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';

const openApiDir = path.join(__dirname, '..');

function loadOpenApi(filename: string) {
  return JSON.parse(fs.readFileSync(path.join(openApiDir, filename), 'utf-8'));
}

const swaggerMobile = loadOpenApi('swagger-mobile.json');
const swaggerAdmin = loadOpenApi('swagger-admin.json');
const swaggerCombined = loadOpenApi('swagger.json');

const sendJson =
  (doc: object) =>
  (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(doc);
  };

app.get('/swagger-mobile.json', sendJson(swaggerMobile));
app.get('/swagger-admin.json', sendJson(swaggerAdmin));
app.get('/swagger.json', sendJson(swaggerCombined));

// serveFiles embeds each spec in its own swagger-ui-init.js (shared swaggerUi.serve breaks multi-spec)
const swaggerExplorerOpts = {
  swaggerOptions: {
    urls: [
      { url: '/swagger-mobile.json', name: 'Mobile app' },
      { url: '/swagger-admin.json', name: 'Admin dashboard' },
    ],
  },
};

app.use(
  '/swagger/mobile',
  ...swaggerUi.serveFiles(swaggerMobile),
  swaggerUi.setup(swaggerMobile, { customSiteTitle: 'Jikanzo Mobile API' })
);
app.use(
  '/swagger/admin',
  ...swaggerUi.serveFiles(swaggerAdmin),
  swaggerUi.setup(swaggerAdmin, { customSiteTitle: 'Jikanzo Admin API' })
);
app.use(
  '/swagger',
  ...swaggerUi.serveFiles(undefined, swaggerExplorerOpts),
  swaggerUi.setup(null, { ...swaggerExplorerOpts, explorer: true })
);


//Routes
app.use('/api',routes);

const port = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  const httpServer = http.createServer(app);
  initSockets(httpServer);
  httpServer.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

export default app;
