import { query } from '@/utils/db';
import { createApiResponse } from '@/utils/base/baseApiResponse';
import { StatusCode } from '@/utils/constant/statusCode';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not defined in environment variables.');
    const statusCode = StatusCode.INTERNAL_SERVER_ERROR;
    return res.status(statusCode)
      .json(createApiResponse(null, statusCode, 'Server configuration error.'));
  }

  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  let token;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7); // Extract token part (after "Bearer ")
  }

  if (!token) {
    const statusCode = StatusCode.UNAUTHORIZED;
    return res.status(statusCode)
      .json(createApiResponse(null, statusCode, 'Access denied. No token provided or invalid format.'));
  }

  // Verify token
  try {
    const decodedToken = jwt.verify(token, JWT_SECRET);

    if (req.method === 'GET') {
      const { userId } = req.query;
      try {
        if (userId) {
          // Only admin can fetch user by userId
          if (decodedToken.roleId !== '1' && userId !== decodedToken.userId) {
            const sc = StatusCode.FORBIDDEN;
            return res.status(sc).json(createApiResponse(null, sc, 'Forbidden.'));
          }
          const users = await query(
            'SELECT user_id, username, name, role_id FROM user WHERE user_id = ?',
            [userId]
          );

          if (users.length === 0) {
            const sc = StatusCode.NOT_FOUND;
            return res.status(sc).json(createApiResponse(null, sc, 'User not found.'));
          }
          const sc = StatusCode.OK;
          return res.status(sc).json(createApiResponse(users[0], sc, 'User retrieved successfully.'));
        } else {
          // Only admin can fetch all users
          if (decodedToken.roleId !== '1') {
            const sc = StatusCode.FORBIDDEN;
            return res.status(sc).json(createApiResponse(null, sc, 'Forbidden.'));
          }
          const users = await query('SELECT user_id, username, name, role_id FROM user');
          const sc = StatusCode.OK;
          return res.status(sc).json(createApiResponse(users, sc, 'Users retrieved successfully.'));
        }
      } catch (error) {
        console.error('Error fetching user(s):', error);
        const sc = StatusCode.INTERNAL_SERVER_ERROR;
        return res.status(sc).json(createApiResponse({ error_details: error.message }, sc, 'An error occurred on the server.'));
      }
    } else {
      res.setHeader('Allow', ['GET']);
      const statusCode = StatusCode.METHOD_NOT_ALLOWED || 405;
      return res.status(statusCode).json(createApiResponse(null, statusCode, `Method ${req.method} Not Allowed`));
    }

  } catch (error) {
    console.error('JWT verification error:', error.name, error.message);
    const statusCode = StatusCode.UNAUTHORIZED;
    let message = 'Access denied. Invalid token.';
    if (error.name === 'TokenExpiredError') {
      message = 'Access denied. Token has expired.';
    }
    return res.status(statusCode)
      .json(createApiResponse({ error_type: error.name }, statusCode, message));
  }
}
