import { Request, Response } from 'express';
import prisma from '../../config/db';
import { AdminLoginSchema } from '../../schema/admin/admin';
import { generateAdminToken } from '../../utils/methods';
import { verifyPassword } from '../../utils/password';

/**
 * @Description Login an admin
 * @Route POST /api/admin/login
 * @Access Public
 */
export const loginAdmin = async (req: Request, res: Response): Promise<any> => {
  const validation = AdminLoginSchema.validate(req.body);
  if (validation.error) {
    const errors = validation.error.details.map((d) => d.message).join(',');
    return res.status(400).json({ status: false, msg: errors });
  }

  const { email, password } = validation.value;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const admin = await prisma.admin.findUnique({
      where: { email: normalizedEmail },
    });

    if (!admin || !admin.isActive) {
      return res.status(401).json({ status: false, msg: 'Invalid email or password' });
    }

    const passwordOk = await verifyPassword(password, admin.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ status: false, msg: 'Invalid email or password' });
    }

    const token = generateAdminToken(admin.id, admin.role);

    await prisma.admin.update({
      where: { id: admin.id },
      data: { currentToken: token },
    });

    return res.status(200).json({
      status: true,
      msg: 'Admin login successful',
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: false, msg: error.message || 'Internal server error' });
  }
};
