import { query } from '@/utils/db';
import { createApiResponse } from '@/utils/base/baseApiResponse';
import { StatusCode } from '@/utils/constant/statusCode';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not defined in environment variables.');
    const statusCode = StatusCode.INTERNAL_SERVER_ERROR;
    return res.status(statusCode)
      .json(createApiResponse(null, statusCode, 'Server configuration error.'));
  }

  // Authenticate with Bearer Token
  const authHeader = req.headers.authorization;
  let token;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    const statusCode = StatusCode.UNAUTHORIZED;
    return res.status(statusCode)
      .json(createApiResponse(null, statusCode, 'Access denied. No token provided or invalid format.'));
  }

  try {
    const decodedToken = jwt.verify(token, JWT_SECRET);

    // Handle GET request if authenticated
    if (req.method === 'GET') {
      const { doctorId } = req.query;

      try {
        if (doctorId) {
          // Fetch a single doctor by doctor_id
          const doctors = await query(
            'SELECT doctor_id, doctor_name, specialist, gender, phone, biography FROM doctor WHERE doctor_id = ?',
            [doctorId]
          );

          if (doctors.length === 0) {
            const statusCode = StatusCode.NOT_FOUND;
            return res.status(statusCode).json(createApiResponse(null, statusCode, 'Doctor not found.'));
          }
          const statusCode = StatusCode.OK;
          return res.status(statusCode).json(createApiResponse(doctors[0], statusCode, 'Doctor retrieved successfully.'));
        } else {
          // Fetch all doctors
          const doctors = await query('SELECT doctor_id, doctor_name, specialist, gender, phone, biography FROM doctor');
          const statusCode = StatusCode.OK;
          return res.status(statusCode).json(createApiResponse(doctors, statusCode, 'Doctors retrieved successfully.'));
        }
      } catch (dbError) {
        console.error('Database error fetching doctor(s):', dbError);
        const statusCode = StatusCode.INTERNAL_SERVER_ERROR;
        return res.status(statusCode).json(createApiResponse({ error_details: dbError.message }, statusCode, 'An error occurred while fetching doctor data.'));
      }
    } else {
      res.setHeader('Allow', ['GET']);
      const statusCode = StatusCode.METHOD_NOT_ALLOWED || 405;
      return res.status(statusCode).json(createApiResponse(null, statusCode, `Method ${req.method} Not Allowed`));
    }

  } catch (authError) {
    // Handle errors from jwt.verify (e.g., TokenExpiredError, JsonWebTokenError)
    console.error('JWT verification error:', authError.name, authError.message);
    const statusCode = StatusCode.UNAUTHORIZED;
    let message = 'Access denied. Invalid token.';
    if (authError.name === 'TokenExpiredError') {
      message = 'Access denied. Token has expired.';
    }
    return res.status(statusCode)
      .json(createApiResponse({ error_type: authError.name }, statusCode, message));
  }
}
