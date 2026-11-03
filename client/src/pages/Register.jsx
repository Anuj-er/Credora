import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUser, FiMail, FiHash, FiArrowRight } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import AuthFrame from '../components/AuthFrame';
import PasswordField from '../components/PasswordField';
import { getRoleHome } from '../utils/roleHome';

const initialForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'student',
  institutionCode: '',
};

export default function Register() {
  const { register, isAuthenticated, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) navigate(getRoleHome(user.role), { replace: true });
  }, [isAuthenticated, user, navigate]);

  const handleChange = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      return toast.error('Complete the required fields.');
    }
    if (formData.password.length < 6) return toast.error('Password must be at least 6 characters.');
    if (formData.password !== formData.confirmPassword) return toast.error('Passwords do not match.');
    if (formData.role === 'university' && !formData.institutionCode.trim()) {
      return toast.error('Enter the institution code provided by your administrator.');
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
      };
      if (formData.role === 'university') payload.institutionCode = formData.institutionCode.trim();
      await register(payload);
      toast.success('Account created. Sign in to continue.');
      navigate('/login');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Could not create account.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <div className="auth-loading"><LoadingSpinner text="Preparing registration…" /></div>;

  return (
    <AuthFrame
      step="03"
      eyebrow="CREATE YOUR ACCESS"
      title="Create account"
      description="Set up a profile to manage or receive academic credentials."
      footer={<>Already have an account? <Link to="/login">Sign in <FiArrowRight aria-hidden="true" /></Link></>}
    >
      <form onSubmit={handleSubmit} className="auth-form auth-form-register">
        <div className="auth-field">
          <label htmlFor="name" className="label">Full name</label>
          <div className="auth-input-wrap">
            <FiUser aria-hidden="true" />
            <input id="name" name="name" type="text" autoComplete="name" required value={formData.name} onChange={handleChange} className="input-field" placeholder="Your name" />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="email" className="label">Email address</label>
          <div className="auth-input-wrap">
            <FiMail aria-hidden="true" />
            <input id="email" name="email" type="email" autoComplete="email" required value={formData.email} onChange={handleChange} className="input-field" placeholder="name@example.com" />
          </div>
        </div>

        <div className="auth-field-grid">
          <PasswordField id="password" name="password" label="Password" autoComplete="new-password" required value={formData.password} onChange={handleChange} placeholder="At least 6 characters" />
          <PasswordField id="confirmPassword" name="confirmPassword" label="Confirm password" autoComplete="new-password" required value={formData.confirmPassword} onChange={handleChange} placeholder="Repeat password" />
        </div>

        <div className="auth-field">
          <label htmlFor="role" className="label">Account type</label>
          <select id="role" name="role" value={formData.role} onChange={handleChange} className="input-field">
            <option value="student">Student</option>
            <option value="university">University</option>
            <option value="verifier">Verifier</option>
          </select>
        </div>

        {formData.role === 'university' && (
          <motion.div className="auth-field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <label htmlFor="institutionCode" className="label">Institution code</label>
            <div className="auth-input-wrap">
              <FiHash aria-hidden="true" />
              <input id="institutionCode" name="institutionCode" type="text" required value={formData.institutionCode} onChange={handleChange} className="input-field" placeholder="Code from your administrator" />
            </div>
            <p className="field-hint">Your institution must be approved before registration.</p>
          </motion.div>
        )}

        <button type="submit" disabled={submitting} className="btn-primary auth-submit">
          {submitting ? 'Creating account…' : <>Create account <FiArrowRight aria-hidden="true" /></>}
        </button>
      </form>
    </AuthFrame>
  );
}
