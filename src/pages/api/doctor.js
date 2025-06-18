import { query } from '@/utils/db';
import { createApiResponse } from '@/utils/base/baseApiResponse';
import { StatusCode } from '@/utils/constant/statusCode';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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
      const { doctor_name, specialist, gender, phone, biography, hospital, schedules } = req.body;

      if (!doctor_name || !specialist || !gender || !phone || !biography || !hospital) {
        res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, 'Semua kolom dokter wajib diisi.'));
        return;
      }

      if (!Array.isArray(schedules) || schedules.length === 0) {
        res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, 'Jadwal harus berupa array yang tidak kosong.'));
        return;
      }

      try {
        const doctorResult = await query(
          'INSERT INTO doctor (doctor_name, specialist, gender, phone, biography, hospital) VALUES (?, ?, ?, ?, ?, ?)',
          [doctor_name, specialist, gender, phone, biography, hospital]
        );

        const doctor_id = doctorResult.insertId;

        for (const sch of schedules) {
          const { schedule_id } = sch;

          await query(
            'INSERT INTO doctor_schedule (doctor_id, schedule_id) VALUES (?, ?)',
            [doctor_id, schedule_id]
          );
        }

        const statusCode = StatusCode.CREATED;
        res.status(statusCode).json(createApiResponse({ doctor_id: doctor_id, doctor_name: doctor_name }, statusCode, 'Doctor added successfully.'));
        return;

      } catch (error) {
        console.error('Error add doctors:', error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Error add doctors.'));
        return;
      }
    }

    // --- Handle PUT request ---
    else if (req.method === 'PUT') {
      const { doctorId } = req.query;

      if (!doctorId) {
        res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, 'Doctor ID is required.'));
        return;
      }
      const { doctor_name, specialist, gender, phone, biography, hospital, schedules } = req.body;

      if (!doctor_name || !specialist || !gender || !phone || !biography || !hospital) {
        res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, 'Semua kolom dokter wajib diisi.'));
        return;
      }

      if (!Array.isArray(schedules)) {
        res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, 'Jadwal harus berupa array.'));
        return;
      }

      try {
        await query(
          'UPDATE doctor SET doctor_name = ?, specialist = ?, gender = ?, phone = ?, biography = ?, hospital = ? WHERE doctor_id = ?',
          [doctor_name, specialist, gender, phone, biography, hospital, doctorId]
        );

        await query('DELETE FROM doctor_schedule WHERE doctor_id = ?', [doctorId]);

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
        res.status(statusCode).json(createApiResponse(doctor, statusCode, 'Doctor updated successfully.'));
        return;
      } catch (error) {
        console.error('Error updating doctor:', error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Error updating doctor.'));
        return;
      }
    }

    // --- Handle DELETE request ---
    else if (req.method === 'DELETE') {
      const { doctorId } = req.query;

      if (!doctorId) {
        res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, 'Doctor ID is required.'));
        return;
      }

      try {
        // Delete from doctor_schedule
        await query('DELETE FROM doctor_schedule WHERE doctor_id = ?', [doctorId]);

        // Delete from doctor
        const result = await query('DELETE FROM doctor WHERE doctor_id = ?', [doctorId]);

        if (result.affectedRows === 0) {
          const statusCode = StatusCode.NOT_FOUND;
          res.status(statusCode).json(createApiResponse(null, statusCode, 'Doctor not found.'));
          return;
        }

        const statusCode = StatusCode.OK;
        res.status(statusCode).json(createApiResponse(null, statusCode, 'Doctor deleted successfully.'));
        return;
      } catch (error) {
        console.error('Error deleting doctor:', error);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Error deleting doctor.'));
        return;
      }
    }

    // --- Handle GET request ---
    else if (req.method === 'GET') {
      const { doctorId } = req.query;

      try {
        if (doctorId) {
          const doctors = await query(
            'SELECT doctor_id, doctor_name, specialist, gender, phone, biography, hospital FROM doctor WHERE doctor_id = ?',
            [doctorId]
          );
          const schedules = await query(
            'SELECT s.schedule_id, s.day, s.start, s.end FROM doctor_schedule ds JOIN schedule s ON ds.schedule_id = s.schedule_id WHERE ds.doctor_id = ?',
            [doctorId]
          );

          if (doctors.length === 0) {
            const statusCode = StatusCode.NOT_FOUND;
            res.status(statusCode).json(createApiResponse(null, statusCode, 'Doctor not found.'));
            return;
          }
          const statusCode = StatusCode.OK;
          const doctor = {
            ...doctors[0],
            schedules: schedules.map(schedule => ({
              schedule_id: schedule.schedule_id,
              day: schedule.day,
              start: schedule.start,
              end: schedule.end
            }))
          };

          res.status(statusCode).json(createApiResponse(doctor, statusCode, 'Doctor retrieved successfully.'));
          return;
        } else {
          const doctors = await query('SELECT doctor_id, doctor_name, specialist, gender, phone, biography, hospital FROM doctor');
          const doctorIds = doctors.map(doc => doc.doctor_id);
          let allSchedules = [];
          if (doctorIds.length > 0) {
            const placeholders = doctorIds.map(() => '?').join(',');
            allSchedules = await query(
              `SELECT ds.doctor_id, s.schedule_id, s.day, s.start, s.end FROM doctor_schedule ds JOIN schedule s ON ds.schedule_id = s.schedule_id WHERE ds.doctor_id IN (${placeholders})`,
              doctorIds
            );
          }

          const schedulesMap = new Map();
          allSchedules.forEach(schedule => {
            if (!schedulesMap.has(schedule.doctor_id)) {
              schedulesMap.set(schedule.doctor_id, []);
            }
            schedulesMap.get(schedule.doctor_id).push({
              schedule_id: schedule.schedule_id,
              day: schedule.day,
              start: schedule.start,
              end: schedule.end
            });
          });

          const doctorsWithSchedules = doctors.map(doc => ({
            ...doc,
            schedules: schedulesMap.get(doc.doctor_id) || []
          }));

          const statusCode = StatusCode.OK;
          res.status(statusCode).json(createApiResponse(doctorsWithSchedules, statusCode, 'Daftar dokter berhasil diambil.'));
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

/*
function validateField(field) {
  if (!field) {
    const message = field + ' is required.';
    console.error(message);
    // ...
  }
}
*/