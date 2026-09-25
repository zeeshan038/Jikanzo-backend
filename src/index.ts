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

// Swagger Setup
import swaggerUi from 'swagger-ui-express';
import fs from 'fs'; 
import path from 'path';

const swaggerDocument = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../swagger.json'), 'utf-8')
);

const options = {
  swaggerOptions: {
    url: '/swagger.json'
  }
};
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(undefined, options));

// Serve the raw swagger JSON
app.get('/swagger.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocument);
});


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
