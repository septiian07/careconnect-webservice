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
    // Handle POST request if authenticated
    if (req.method === 'POST') {
      const { doctor_name, specialist, gender, phone, biography, hospital, schedules } = req.body;

      // validateField(doctor_name);
      // validateField(specialist);
      // validateField(gender);
      // validateField(phone);
      // validateField(biography);
      // validateField(hospital);
      // validateField(schedules);

      if (!Array.isArray(schedules) || schedules.length === 0) {
        return res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, 'Schedules must be a non-empty array.'));
      }

      try {
        // Insert into doctor
        const doctorResult = await query(
          'INSERT INTO doctor (doctor_name, specialist, gender, phone, biography, hospital) VALUES (?, ?, ?, ?, ?, ?)',
          [doctor_name, specialist, gender, phone, biography, hospital]
        );

        const doctor_id = doctorResult.insertId;

        for (const sch of schedules) {
          const { schedule_id } = sch;

          // Insert into doctor_schedule
          await query(
            'INSERT INTO doctor_schedule (doctor_id, schedule_id) VALUES (?, ?)',
            [doctor_id, schedule_id]
          );
        }

        const statusCode = StatusCode.CREATED;
        return res.status(statusCode).json(createApiResponse({ doctor_id: doctor_id, doctor_name: doctor_name }, statusCode, 'Doctor added successfully.'));

      } catch (error) {
        console.error('Error add doctors:', error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Error add doctors.'));
      }
    } else if (req.method === 'PUT') {
      const { doctorId } = req.query;

      if (!doctorId) {
        return res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, 'Doctor ID is required.'));
      }
      const { doctor_name, specialist, gender, phone, biography, hospital, schedules } = req.body;

      if (!Array.isArray(schedules) || schedules.length === 0) {
        return res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, 'Schedules must be a non-empty array.'));
      }

      try {
        await query(
          'UPDATE doctor SET doctor_name = ?, specialist = ?, gender = ?, phone = ?, biography = ?, hospital = ? WHERE doctor_id = ?',
          [doctor_name, specialist, gender, phone, biography, hospital, doctorId]
        );

        await query('DELETE FROM doctor_schedule WHERE doctor_id = ?',
          [doctorId]
        );

        if (schedules.length > 0) {
          const placeholders = schedules.map(() => '(?, ?)').join(',');
          const values = schedules.flatMap(sch => [doctorId, sch.schedule_id]);

          const sql = `INSERT INTO doctor_schedule (doctor_id, schedule_id) VALUES ${placeholders}`;
          await query(sql, values);
        }

        const doctor = {
          doctor_id: doctorId,
          doctor_name: doctor_name,
          specialist: specialist,
          gender: gender,
          phone: phone,
          biography: biography,
          hospital: hospital,
        }

        const statusCode = StatusCode.OK;
        return res.status(statusCode).json(createApiResponse(doctor, statusCode, 'Doctor updated successfully.'));
      } catch (error) {
        console.error('Error updating doctor:', error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Error updating doctor.'));
      }
    }
    else if (req.method === 'DELETE') {
      const { doctorId } = req.query;

      if (!doctorId) {
        return res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, 'Doctor ID is required.'));
      }

      try {
        // Delete from doctor_schedule
        await query('DELETE FROM doctor_schedule WHERE doctor_id = ?', [doctorId]);

        // Delete from doctor
        const result = await query('DELETE FROM doctor WHERE doctor_id = ?', [doctorId]);

        if (result.affectedRows === 0) {
          const statusCode = StatusCode.NOT_FOUND;
          return res.status(statusCode).json(createApiResponse(null, statusCode, 'Doctor not found.'));
        }

        const statusCode = StatusCode.OK;
        return res.status(statusCode).json(createApiResponse(null, statusCode, 'Doctor deleted successfully.'));
      } catch (error) {
        console.error('Error deleting doctor:', error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Error deleting doctor.'));
      }
    }
    // Handle GET request if authenticated
    else if (req.method === 'GET') {
      const { doctorId } = req.query;

      try {
        if (doctorId) {
          // Fetch a single doctor by doctor_id
          const doctors = await query(
            'SELECT doctor_id, doctor_name, specialist, gender, phone, biography FROM doctor WHERE doctor_id = ?',
            [doctorId]
          );
          const schedules = await query('SELECT s.day, s.start, s.end FROM doctor d JOIN doctor_schedule ds ON d.doctor_id = ds.doctor_id JOIN schedule s ON ds.schedule_id = s.schedule_id WHERE d.doctor_id = ?',
            [doctorId]);

          if (doctors.length === 0) {
            const statusCode = StatusCode.NOT_FOUND;
            return res.status(statusCode).json(createApiResponse(null, statusCode, 'Doctor not found.'));
          }
          const statusCode = StatusCode.OK;
          const doctor = {
            ...doctors[0],
            schedules: schedules.map(schedule => ({
              day: schedule.day,
              start: schedule.start,
              end: schedule.end
            }))
          };

          return res.status(statusCode).json(createApiResponse(doctor, statusCode, 'Doctor retrieved successfully.'));
        } else {
          // Fetch all doctors
          const doctors = await query('SELECT doctor_id, doctor_name, specialist, gender, phone, biography, hospital FROM doctor');
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
    // Handle errors from jwt.verify (TokenExpiredError, JsonWebTokenError)
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

function validateField(field) {
  if (!field) {
    const message = field + ' is required.';
    console.error(message);
    return res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, message));
  }
}
