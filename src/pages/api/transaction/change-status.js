import { query } from '@/utils/db';
import { createApiResponse } from '@/utils/base/baseApiResponse';
import { StatusCode } from '@/utils/constant/statusCode';
import { validateRequiredFields } from '@/utils/helper/validationHelper';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  res.setHeader('Access-Control-Allow-Origin', baseUrl);
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not defined in environment variables.');
    const statusCode = StatusCode.INTERNAL_SERVER_ERROR;
    res.status(statusCode).json(createApiResponse(null, statusCode, 'Server configuration error.'));
    return;
  }

  const authHeader = req.headers.authorization;
  let token;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    const statusCode = StatusCode.UNAUTHORIZED;
    res.status(statusCode).json(createApiResponse(null, statusCode, 'Access denied. No token provided or invalid format.'));
    return;
  }

  try {
    if (req.method === 'PUT') {
      const { transactionId, status } = req.query;

      const requiredFields = ['transactionId', 'status'];

      const validationError = validateRequiredFields(req.query, requiredFields);

      if (validationError) {
        res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, validationError));
        return;
      }

      try {
        const result = await query(
          'UPDATE transaction SET status = ? WHERE transaction_id = ?',
          [status, transactionId]
        );

        if (result.affectedRows === 0) {
          const statusCode = StatusCode.NOT_FOUND;
          res.status(statusCode).json(createApiResponse(null, statusCode, 'Transaction not found.'));
          return;
        }

        const statusCode = StatusCode.OK;
        res.status(statusCode).json(createApiResponse(null, statusCode, 'Transaction status updated successfully.'));
        return;
      } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Error updating status transaction.'));
        return;
      }
    } else {
      res.setHeader('Allow', ['PUT']);
      const statusCode = StatusCode.METHOD_NOT_ALLOWED || 405;
      res.status(statusCode).json(createApiResponse(null, statusCode, `Method ${req.method} Not Allowed`));
      return;
    }
  } catch (authError) {
    console.error('JWT verification error:', authError.name, authError.message);
    const statusCode = StatusCode.UNAUTHORIZED;
    let message = 'Access denied. Invalid token.';
    if (authError.name === 'TokenExpiredError') {
      message = 'Access denied. Token has expired.';
    }
    res.status(statusCode).json(createApiResponse({ error_type: authError.name }, statusCode, message));
    return;
  }
}
