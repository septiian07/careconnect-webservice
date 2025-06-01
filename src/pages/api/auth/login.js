import { query } from '@/utils/db';
import { createApiResponse } from '@/utils/base/baseApiResponse';
import { StatusCode } from '@/utils/constant/statusCode';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(StatusCode.OK).end();
  }

  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not defined in environment variables.');
    return res.status(StatusCode.INTERNAL_SERVER_ERROR)
      .json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Server configuration error.'));
  }

  if (req.method === 'POST') {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(StatusCode.BAD_REQUEST)
        .json(createApiResponse(null, StatusCode.BAD_REQUEST, 'Username and password are required.'));
    }

    try {
      const users = await query('SELECT user_id, username, name, password, role_id FROM user WHERE username = ?', [username]);

      if (users.length === 0) {
        return res.status(StatusCode.UNAUTHORIZED)
          .json(createApiResponse(null, StatusCode.UNAUTHORIZED, 'Invalid username or password.'));
      }

      const user = users[0];
      const passwordIsValid = await bcrypt.compare(password, user.password);

      if (!passwordIsValid) {
        return res.status(StatusCode.UNAUTHORIZED)
          .json(createApiResponse(null, StatusCode.UNAUTHORIZED, 'Invalid username or password.'));
      }

      const tokenPayload = {
        userId: user.user_id,
        username: user.username,
        name: user.name,
        roleId: user.role_id,
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRATION || '1h',
      });

      const responseData = {
        user: {
          userId: user.user_id,
          username: user.username,
          name: user.name,
          roleId: user.role_id,
        },
        token: token,
      };

      return res.status(StatusCode.OK)
        .json(createApiResponse(responseData, StatusCode.OK, 'Login successful.'));

    } catch (error) {
      console.error('Login error:', error);
      return res.status(StatusCode.INTERNAL_SERVER_ERROR)
        .json(createApiResponse({ error_details: error.message }, StatusCode.INTERNAL_SERVER_ERROR, 'An internal server error occurred.'));
    }
  } else {
    res.setHeader('Allow', ['POST', 'OPTIONS']); // Include OPTIONS in the Allow header
    return res.status(StatusCode.METHOD_NOT_ALLOWED)
      .json(createApiResponse(null, StatusCode.METHOD_NOT_ALLOWED, `Method ${req.method} Not Allowed`));
  }
}
