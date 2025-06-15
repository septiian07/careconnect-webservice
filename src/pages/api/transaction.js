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
      const { user_id, doctor_id, date, time, method, status } = req.body;
      const note = req.body.note || null;

      const requiredFields = ['user_id', 'doctor_id', 'date', 'time', 'method', 'status'];

      const validationError = validateRequiredFields(req.body, requiredFields);

      if (validationError) {
        res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, validationError));
        return;
      }

      try {
        const result = await query(
          'INSERT INTO transaction (user_id, doctor_id, date, time, method, status, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [user_id, doctor_id, date, time, method, status, note]
        );

        const newTransactionId = result.insertId;
        const statusCode = StatusCode.CREATED;
        res.status(statusCode).json(createApiResponse({ transactionId: newTransactionId }, statusCode, 'Transaction created successfully.'));
        return;
      } catch (error) {
        console.error('Error creating transaction:', error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Error creating transaction.'));
        return;
      }
    }

    // --- Handle PUT request ---
    else if (req.method === 'PUT') {
      const { transactionId } = req.query;
      const { user_id, doctor_id, date, time, method, status, note } = req.body;

      const requiredFields = ['user_id', 'doctor_id', 'date', 'time', 'method', 'status'];

      const validationTransactionIdError = validateRequiredFields(req.query, ['transactionId']);
      const validationError = validateRequiredFields(req.body, requiredFields);

      if (validationError || validationTransactionIdError) {
        res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, validationError));
        return;
      }

      try {
        const result = await query(
          'UPDATE transaction SET user_id = ?, doctor_id = ?, date = ?, time = ?, method = ?, status = ?, note = ? WHERE transaction_id = ?',
          [user_id, doctor_id, date, time, method, status, note, transactionId]
        );

        if (result.affectedRows === 0) {
          const statusCode = StatusCode.NOT_FOUND;
          res.status(statusCode).json(createApiResponse(null, statusCode, 'Transaction not found.'));
          return;
        }

        const statusCode = StatusCode.OK;
        res.status(statusCode).json(createApiResponse(null, statusCode, 'Transaction updated successfully.'));
        return;
      } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Error updating transaction.'));
        return;
      }
    }

    // --- Handle DELETE request ---
    else if (req.method === 'DELETE') {
      const { transactionId } = req.query;

      if (!transactionId) {
        res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, 'Transaction ID is required.'));
        return;
      }

      try {
        // Delete from transaction 
        const result = await query('DELETE FROM transaction WHERE transaction_id = ?', [transactionId]);

        if (result.affectedRows === 0) {
          const statusCode = StatusCode.NOT_FOUND;
          res.status(statusCode).json(createApiResponse(null, statusCode, 'Transaction not found.'));
          return;
        }

        const statusCode = StatusCode.OK;
        res.status(statusCode).json(createApiResponse(null, statusCode, 'Transaction deleted successfully.'));
        return;
      } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Error deleting transaction.'));
        return;
      }
    }

    // --- Handle GET request ---
    else if (req.method === 'GET') {
      const { transactionId } = req.query;

      try {
        if (transactionId) {
          const transactions = await query(
            'SELECT t.transaction_id, u.name AS user_name, d.doctor_name, d.hospital, t.date, t.time, t.method, t.status, t.note ' +
            'FROM transaction t JOIN doctor d ON t.doctor_id = d.doctor_id JOIN user u ON t.user_id = u.user_id WHERE t.transaction_id = ?',
            [transactionId]
          );

          if (transactions.length === 0) {
            const statusCode = StatusCode.NOT_FOUND;
            res.status(statusCode).json(createApiResponse(null, statusCode, 'Transaction not found.'));
            return;
          }
          const statusCode = StatusCode.OK;
          const transaction = {
            ...transactions[0],
          };

          res.status(statusCode).json(createApiResponse(transaction, statusCode, 'Transaction retrieved successfully.'));
          return;
        } else {
          const doctors = await query(
            'SELECT t.transaction_id, u.name AS user_name, d.doctor_name, d.hospital, t.date, t.time, t.method, t.status, t.note ' +
            'FROM transaction t JOIN doctor d ON t.doctor_id = d.doctor_id JOIN user u ON t.user_id = u.user_id',
          );

          const transaction = doctors.map(trx => ({
            ...trx,
          }));

          const statusCode = StatusCode.OK;
          res.status(statusCode).json(createApiResponse(transaction, statusCode, 'Transactions retrieved successfully.'));
          return;
        }
      } catch (dbError) {
        console.error('Database error fetching doctor(s):', dbError);
        const statusCode = StatusCode.INTERNAL_SERVER_ERROR;
        res.status(statusCode).json(createApiResponse({ error_details: dbError.message }, statusCode, 'An error occurred while fetching doctor data.'));
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
