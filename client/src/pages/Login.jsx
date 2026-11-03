import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiMail, FiArrowRight } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import AuthFrame from '../components/AuthFrame';
import PasswordField from '../components/PasswordField';
import { getPostLoginPath } from '../utils/roleHome';

export default function Login() {
  const { login, isAuthenticated, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) navigate(getPostLoginPath(user.role, location.state?.from), { replace: true });
  }, [isAuthenticated, user, location.state, navigate]);

  const handleChange = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.email || !formData.password) return toast.error('Enter your email and password.');

    setSubmitting(true);
    try {
      await login(formData.email, formData.password);
      toast.success('Signed in.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <div className="auth-loading"><LoadingSpinner text="Checking your session…" /></div>;

  return (
    <AuthFrame
      step="02"
      eyebrow="WELCOME BACK"
      title="Sign in"
      description="Continue to your credential workspace."
      footer={<>New to Credora? <Link to="/register">Create an account <FiArrowRight aria-hidden="true" /></Link></>}
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label htmlFor="email" className="label">Email address</label>
          <div className="auth-input-wrap">
            <FiMail aria-hidden="true" />
            <input
              id="email" name="email" type="email" autoComplete="email" required
              value={formData.email} onChange={handleChange}
              className="input-field" placeholder="name@example.com"
            />
          </div>
        </div>

        <PasswordField
          id="password"
          name="password"
          label="Password"
          value={formData.password}
          onChange={handleChange}
          autoComplete="current-password"
          placeholder="Enter your password"
          required
          privateLabel="PRIVATE"
        />

        <button type="submit" disabled={submitting} className="btn-primary auth-submit">
          {submitting ? 'Signing in…' : <>Enter workspace <FiArrowRight aria-hidden="true" /></>}
        </button>
      </form>
    </AuthFrame>
  );
}
