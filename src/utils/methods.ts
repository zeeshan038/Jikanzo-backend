import jwt from 'jsonwebtoken';

//Genrate token
export const genrateToken = (id: string) => {
    return jwt.sign({ _id: id }, process.env.JWT_SECRET as string, { expiresIn: '7d' });
}


