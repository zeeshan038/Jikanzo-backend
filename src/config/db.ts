import { PrismaClient } from '@prisma/client';

// Use different variable name to avoid conflict with imported PrismaClient
const prismaClient = new PrismaClient();

export default prismaClient;