import { query } from '@/utils/db';
import { createApiResponse } from '@/utils/base/baseApiResponse';
import { StatusCode } from '@/utils/constant/statusCode';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  res.setHeader('Access-Control-Allow-Origin', baseUrl);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { username, name, password, role_id } = req.body;

    if (!username || !password || !name || role_id === undefined || role_id === null || role_id === '') {
      return res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, 'Semua kolom wajib diisi.'));
    }

    const parsedRoleId = parseInt(role_id, 10);
    if (isNaN(parsedRoleId) || parsedRoleId <= 0) {
      return res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, 'ID Peran tidak valid.'));
    }

    try {

      const existingUsers = await query('SELECT user_id FROM user WHERE username = ?', [username]);
      if (existingUsers.length > 0) {
        return res.status(StatusCode.CONFLICT).json(createApiResponse(null, StatusCode.CONFLICT, 'Username sudah terdaftar.'));
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const result = await query(
        'INSERT INTO user (username, name, password, role_id) VALUES (?, ?, ?, ?)',
        [username, name, hashedPassword, parsedRoleId]
      );

      const newUserId = result.insertId;

      return res.status(StatusCode.CREATED).json(createApiResponse({ userId: newUserId, username: username }, StatusCode.CREATED, 'User registered successfully.'));

    } catch (error) {
      console.error('Registration error:', error);
      return res.status(StatusCode.INTERNAL_SERVER_ERROR).json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Terjadi kesalahan saat mendaftar pengguna.'));
    }
  } else {
    res.setHeader('Allow', ['POST']);
    return res.status(StatusCode.METHOD_NOT_ALLOWED).json(createApiResponse(null, StatusCode.METHOD_NOT_ALLOWED, `Method ${req.method} Not Allowed`));
  }
}