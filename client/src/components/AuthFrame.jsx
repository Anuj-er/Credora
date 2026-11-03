import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowUpRight, FiCheck } from 'react-icons/fi';

export default function AuthFrame({ eyebrow, title, description, children, footer, step }) {
  return (
    <div className="auth-page">
      <div className="auth-layout">
        <aside className="auth-story">
          <Link to="/" className="auth-brand">
            <span className="brand-mark" aria-hidden="true" />
            <span>CREDORA</span>
            <span className="auth-brand-slash">/</span>
            <span className="auth-brand-caption">VERIFIABLE RECORDS</span>
          </Link>

          <div className="auth-story-copy">
            <p className="eyebrow auth-story-kicker"><span className="signal-dot" /> TRUST LAYER / 01</p>
            <h1>
              Academic records,<br />
              <span className="glitch-word">made verifiable.</span>
            </h1>
            <p className="auth-story-description">
              A clear path from institution-issued credentials to proof anyone can check.
            </p>

            <div className="auth-artifact" aria-label="Credential verification status">
              <div className="auth-artifact-head">
                <span>RECORD / SAMPLE</span>
                <span>01—A</span>
              </div>
              <div className="auth-artifact-body">
                <span className="auth-artifact-mark" aria-hidden="true">
                  <i /><i /><i />
                </span>
                <div>
                  <span className="auth-artifact-label">INTEGRITY CHECK</span>
                  <strong><FiCheck aria-hidden="true" /> READY TO VERIFY</strong>
                </div>
                <FiArrowUpRight className="auth-artifact-arrow" aria-hidden="true" />
              </div>
              <div className="auth-artifact-foot">
                <span>ISSUE</span><i /><span>ANCHOR</span><i /><span>VERIFY</span>
              </div>
            </div>
          </div>

          <div className="auth-story-foot">
            <span>IDENTITY / {step}</span>
            <span>LOCAL ACCESS <i className="signal-dot" /></span>
          </div>
        </aside>

        <motion.section
          className="auth-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
        >
          <div className="auth-card-mark"><span className="glitch-rule"><i /><i /><i /></span><span>SECURE ACCESS</span></div>
          <header className="auth-card-head">
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            <p>{description}</p>
          </header>
          {children}
          <div className="auth-footer">{footer}</div>
        </motion.section>
      </div>
    </div>
  );
}
