import React, { useState } from 'react';
import { useRouter } from 'next/router';
import 'bootstrap/dist/css/bootstrap.min.css';

export default function Register() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    username: '',
    name: '',
    password: '',
    role_id: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!formData.username || !formData.name || !formData.password || !formData.role_id) {
        setError("Please fill in all required fields.");
        setLoading(false);
        return;
    }

    try {
      const apiUrl = '/api/auth/register'; // api register

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          name: formData.name,
          password: formData.password,
          role_id: parseInt(formData.role_id),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setError(null);
        console.log('Registration successful:', data);
        router.push('/login'); // halaman login
      } else {
        setError(data.message || 'Registration failed. Please try again.');
        console.error('Registration failed:', data);
      }
    } catch (err) {
      setError('An error occurred during registration. Please check your network connection.');
      console.error('Network error or unexpected:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid d-flex justify-content-center align-items-center min-vh-100 bg-light p-3">
      <div className="card shadow-lg border-0 rounded-4" style={{ maxWidth: '1000px', width: '100%' }}>
        <div className="row g-0">
          <div className="col-md-6 d-flex flex-column justify-content-center p-4 p-md-5">
            <h1 className="h2 fw-bold mb-4 text-center">Sign up</h1>

            {success && (
              <div className="alert alert-success text-center" role="alert">
                User registered successfully! Redirecting to login...
              </div>
            )}
            {error && (
              <div className="alert alert-danger text-center" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="username" className="form-label">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  className="form-control form-control-lg"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="name" className="form-label">Full Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="form-control form-control-lg"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="password" className="form-label">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="form-control form-control-lg"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="role_id" className="form-label">Role ID</label>
                <input
                  type="number"
                  id="role_id"
                  name="role_id"
                  className="form-control form-control-lg"
                  value={formData.role_id}
                  onChange={handleChange}
                  required
                  min="1"
                />
              </div>

              <div className="d-grid">
                <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      {' '}Registering...
                    </>
                  ) : 'Register'}
                </button>
              </div>
            </form>
          </div>

          <div className="col-md-6 d-none d-md-flex align-items-center justify-content-center bg-light p-4 p-md-5">
            <img
              src='img/1.jpg'
              alt='Registration illustration'
              className='img-fluid rounded-3'
            />
          </div>
        </div>
      </div>
    </div>
  );
}