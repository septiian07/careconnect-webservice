import { query } from '@/utils/db';
import { createApiResponse } from '@/utils/base/baseApiResponse';
import { StatusCode } from '@/utils/constant/statusCode';
import { validateRequiredFields } from '@/utils/helper/validationHelper';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  res.setHeader('Access-Control-Allow-Origin', baseUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
    const decodedToken = jwt.verify(token, JWT_SECRET);

    // --- Handle POST request ---
    if (req.method === 'POST') {
      const { day, start, end } = req.body;

      const requiredFields = ['day', 'start', 'end'];

      const validationError = validateRequiredFields(req.body, requiredFields);

      if (validationError) {
        res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, validationError));
        return;
      }

      try {
        const result = await query(
          'INSERT INTO schedule (day, start, end) VALUES (?, ?, ?)',
          [day, start, end]
        );

        const newScheduleId = result.insertId;
        const statusCode = StatusCode.CREATED;
        res.status(statusCode).json(createApiResponse({ scheduleId: newScheduleId }, statusCode, 'Schedule created successfully.'));
        return;
      } catch (error) {
        console.error('Error creating schedule:', error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Error creating schedule.'));
        return;
      }
    }

    // --- Handle PUT request ---
    else if (req.method === 'PUT') {
      const { scheduleId } = req.query;
      const { day, start, end } = req.body;

      const requiredFields = ['day', 'start', 'end'];

      const validationScheduleIdError = validateRequiredFields(req.query, ['scheduleId']);
      const validationError = validateRequiredFields(req.body, requiredFields);

      if (validationError || validationScheduleIdError) {
        res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, validationError));
        return;
      }

      try {
        const result = await query(
          'UPDATE schedule SET day = ?, start = ?, end = ? WHERE schedule_id = ?',
          [day, start, end, scheduleId]
        );

        if (result.affectedRows === 0) {
          const statusCode = StatusCode.NOT_FOUND;
          res.status(statusCode).json(createApiResponse(null, statusCode, 'Schedule not found.'));
          return;
        }

        const statusCode = StatusCode.OK;
        res.status(statusCode).json(createApiResponse(null, statusCode, 'Schedule updated successfully.'));
        return;
      } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Error updating schedule.'));
        return;
      }
    }

    // --- Handle DELETE request ---
    else if (req.method === 'DELETE') {
      const { scheduleId } = req.query;

      if (!scheduleId) {
        res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, 'Schedule ID is required.'));
        return;
      }

      try {
        // Delete from schedule 
        const result = await query('DELETE FROM schedule WHERE schedule_id = ?', [scheduleId]);

        if (result.affectedRows === 0) {
          const statusCode = StatusCode.NOT_FOUND;
          res.status(statusCode).json(createApiResponse(null, statusCode, 'Schedule not found.'));
          return;
        }

        const statusCode = StatusCode.OK;
        res.status(statusCode).json(createApiResponse(null, statusCode, 'Schedule deleted successfully.'));
        return;
      } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Error deleting schedule.'));
        return;
      }
    }

    // --- Handle GET request ---
    else if (req.method === 'GET') {
      const { scheduleId } = req.query;

      try {
        if (scheduleId) {
          const schedules = await query(
            'SELECT * FROM schedule WHERE schedule_id = ?',
            [scheduleId]
          );

          if (schedules.length === 0) {
            const statusCode = StatusCode.NOT_FOUND;
            res.status(statusCode).json(createApiResponse(null, statusCode, 'Schedule not found.'));
            return;
          }
          const statusCode = StatusCode.OK;
          const schedule = {
            ...schedules[0],
          };

          res.status(statusCode).json(createApiResponse(schedule, statusCode, 'Schedule retrieved successfully.'));
          return;
        } else {
          const schedules = await query(
            'SELECT * FROM schedule',
          );

          const schedule = schedules.map(trx => ({
            ...trx,
          }));

          const statusCode = StatusCode.OK;
          res.status(statusCode).json(createApiResponse(schedule, statusCode, 'Schedules retrieved successfully.'));
          return;
        }
      } catch (dbError) {
        console.error('Database error fetching schedule(s):', dbError);
        const statusCode = StatusCode.INTERNAL_SERVER_ERROR;
        res.status(statusCode).json(createApiResponse({ error_details: dbError.message }, statusCode, 'An error occurred while fetching schedule data.'));
        return;
      }
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
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
