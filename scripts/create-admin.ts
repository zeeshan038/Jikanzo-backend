/**
 * Create or update a platform admin (uses DATABASE_URL from .env).
 *
 * Option A — add to .env then run:
 *   ADMIN_EMAIL=admin@jikanzo.com
 *   ADMIN_PASSWORD=your-secure-password
 *   ADMIN_ROLE=SUPER_ADMIN
 *   ADMIN_NAME=Super Admin
 *   npm run create-admin
 *
 * Option B — inline env:
 *   ADMIN_EMAIL=admin@jikanzo.com ADMIN_PASSWORD=secret123 npm run create-admin
 *
 * Option C — CLI flags (note the `--` before flags):
 *   npm run create-admin -- --email=admin@jikanzo.com --password=secret123 --role=SUPER_ADMIN
 *
 * Option D — no env/flags: prompts in the terminal (password hidden).
 */
import { AdminRole, PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import readline from 'readline';
import { hashPassword } from '../src/utils/password';

dotenv.config();

const prisma = new PrismaClient();

const VALID_ROLES: AdminRole[] = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'];

function parseCliArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) {
      out[match[1]] = match[2];
    }
  }
  return out;
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Password input without echo (TTY only). */
function askPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      ask(`${prompt} (visible): `).then(resolve);
      return;
    }

    stdout.write(prompt);
    let password = '';

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (chunk: string) => {
      const char = chunk;

      if (char === '\u0003') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        process.exit(130);
      }

      if (char === '\r' || char === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(password);
        return;
      }

      if (char === '\u007f' || char === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          stdout.write('\b \b');
        }
        return;
      }

      password += char;
      stdout.write('*');
    };

    stdin.on('data', onData);
  });
}

async function resolveInputs(): Promise<{
  email: string;
  password: string;
  name: string | null;
  roleRaw: string;
}> {
  const cli = parseCliArgs(process.argv.slice(2));

  let email = (cli.email || process.env.ADMIN_EMAIL)?.trim().toLowerCase();
  let password = cli.password || process.env.ADMIN_PASSWORD;
  let name = (cli.name || process.env.ADMIN_NAME)?.trim() || null;
  let roleRaw = (cli.role || process.env.ADMIN_ROLE || 'SUPER_ADMIN').toUpperCase();

  const interactive = process.stdin.isTTY;

  if (!email) {
    if (!interactive) {
      throw new Error(
        'Set ADMIN_EMAIL and ADMIN_PASSWORD in .env, or pass --email and --password (npm run create-admin -- --email=... --password=...)'
      );
    }
    email = (await ask('Admin email: ')).toLowerCase();
  }

  if (!password) {
    if (!interactive) {
      throw new Error('ADMIN_PASSWORD is required (env, .env, or --password)');
    }
    password = await askPassword('Admin password (min 8 chars): ');
    const confirm = await askPassword('Confirm password: ');
    if (password !== confirm) {
      throw new Error('Passwords do not match');
    }
  }

  if (interactive && !cli.role && !process.env.ADMIN_ROLE) {
    const roleAnswer = await ask(
      `Role ${VALID_ROLES.join(' | ')} [SUPER_ADMIN]: `
    );
    if (roleAnswer) {
      roleRaw = roleAnswer.toUpperCase();
    }
  }

  if (interactive && !name && !cli.name && !process.env.ADMIN_NAME) {
    const nameAnswer = await ask('Display name (optional): ');
    if (nameAnswer) {
      name = nameAnswer;
    }
  }

  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  return { email, password, name, roleRaw };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to .env before running this script.');
    process.exit(1);
  }

  const { email, password, name, roleRaw } = await resolveInputs();

  if (password.length < 8) {
    console.error('Password must be at least 8 characters (same rule as admin login)');
    process.exit(1);
  }

  if (!VALID_ROLES.includes(roleRaw as AdminRole)) {
    console.error(`Role must be one of: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const role = roleRaw as AdminRole;

  const admin = await prisma.admin.upsert({
    where: { email },
    create: { email, passwordHash, name, role, isActive: true },
    update: { passwordHash, name, role, isActive: true },
  });

  console.log(`Admin ready: id=${admin.id} email=${admin.email} role=${admin.role}`);
  console.log('Login: POST /api/admin/login with { "email", "password" }');
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
