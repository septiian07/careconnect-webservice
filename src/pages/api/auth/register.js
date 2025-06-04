import { query } from '@/utils/db';
import { createApiResponse } from '@/utils/base/baseApiResponse';
import { StatusCode } from '@/utils/constant/statusCode';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { username, name, password, role_id } = req.body;

    const countAllUsers = await query('SELECT COUNT(*) AS count FROM user');

    if (!username || !password || !name || !role_id) {
      return res.status(StatusCode.BAD_REQUEST).json(createApiResponse(null, StatusCode.BAD_REQUEST, 'All fields are required.'));
    }

    try {
      // Check if user already exists
      const user_id = countAllUsers[0].count + 1;
      const existingUsers = await query('SELECT user_id FROM user WHERE username = ? OR user_id = ?', [username, user_id]);
      if (existingUsers.length > 0) {
        return res.status(StatusCode.CONFLICT).json(createApiResponse(null, StatusCode.CONFLICT, 'Username or User ID already exists.'));
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const result = await query(
        'INSERT INTO user (username, name, password, role_id) VALUES (?, ?, ?, ?)',
        [username, name, hashedPassword, role_id]
      );

      return res.status(StatusCode.CREATED).json(createApiResponse({ userId: user_id, username: username }, StatusCode.CREATED, 'User registered successfully.'));

    } catch (error) {
      console.error('Registration error:', error);
      return res.status(StatusCode.INTERNAL_SERVER_ERROR).json(createApiResponse(null, StatusCode.INTERNAL_SERVER_ERROR, 'Error registering user.'));
    }
  } else {
    res.setHeader('Allow', ['POST']);
    return res.status(StatusCode.METHOD_NOT_ALLOWED).json(createApiResponse(null, StatusCode.METHOD_NOT_ALLOWED, `Method ${req.method} Not Allowed`));
  }
}
