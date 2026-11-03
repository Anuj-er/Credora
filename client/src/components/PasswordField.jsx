import { useState } from 'react';
import { FiEye, FiEyeOff, FiLock } from 'react-icons/fi';

export default function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
  placeholder,
  required = false,
  privateLabel,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-field">
      <div className="auth-label-row">
        <label htmlFor={id} className="label">{label}</label>
        {privateLabel && <span className="mono-label">{privateLabel}</span>}
      </div>
      <div className="auth-input-wrap">
        <FiLock aria-hidden="true" />
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          value={value}
          onChange={onChange}
          className="input-field auth-password-input"
          placeholder={placeholder}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
