import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  FiArrowRight,
  FiCheckCircle,
  FiLock,
  FiShield,
  FiZap,
} from 'react-icons/fi';

const features = [
  {
    icon: FiShield,
    number: '01',
    title: 'Records that resist tampering',
    description: 'A cryptographic fingerprint anchors each credential to an auditable blockchain record.',
  },
  {
    icon: FiZap,
    number: '02',
    title: 'Verification without the wait',
    description: 'An employer checks a student’s share link against the blockchain record and current revocation status, without an account.',
  },
  {
    icon: FiLock,
    number: '03',
    title: 'Issuing stays in trusted hands',
    description: 'Institution accounts control issuance while students keep easy access to their records.',
  },
];

const steps = [
  { number: '01', title: 'Issue', description: 'An authorized institution creates a credential.' },
  { number: '02', title: 'Anchor', description: 'Its fingerprint is recorded for later comparison.' },
  { number: '03', title: 'Share', description: 'The graduate shares a secure verification link.' },
  { number: '04', title: 'Verify', description: 'A recipient checks the record and its current status.' },
];

export default function LandingPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const roleHome = { admin: '/admin', university: '/university', student: '/student' };
  const workspacePath = roleHome[user?.role];
  const primaryPath = isAuthenticated ? (workspacePath || '/verify') : '/register';
  const primaryLabel = isAuthenticated
    ? (workspacePath ? 'Open workspace' : 'Verify a certificate')
    : 'Create an account';

  return (
    <div className="min-h-screen flex flex-col">
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div className="hero-grid" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-14 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <div className="eyebrow hero-copy-muted">
                <span className="w-2 h-2 rounded-full bg-lime-300" />
                Academic records / made verifiable
              </div>
              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05] max-w-3xl">
                Credentials that hold up.
              </h1>
              <p className="hero-copy-muted mt-6 text-base sm:text-lg leading-relaxed max-w-xl">
                Help graduates share credentials that employers can check without waiting for manual email confirmation. Each link shows whether the details match Credora’s record and whether the certificate has been revoked.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/verify" className="hero-action">
                  Verify a certificate <FiArrowRight className="w-4 h-4" />
                </Link>
                {!authLoading && (!isAuthenticated || workspacePath) && (
                  <Link to={primaryPath} className="hero-action-secondary">
                    {primaryLabel} <FiArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
              <div className="hero-meta mt-9 flex items-center gap-3 text-xs">
                <div className="glitch-rule" aria-hidden="true"><span /><span /><span /></div>
                <span className="mono-label">IPFS STORAGE · ETHEREUM RECORDS</span>
              </div>
            </motion.div>

            <motion.div
              className="relative max-w-md w-full mx-auto lg:ml-auto"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
            >
              <div className="verification-panel p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-200">
                  <div>
                    <p className="mono-label text-slate-500">CREDORA / CREDENTIAL RECORD</p>
                    <p className="mt-2 text-sm font-semibold">Sample credential</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium">
                    <FiCheckCircle className="w-3.5 h-3.5" /> Valid
                  </span>
                </div>

                <div className="py-6">
                  <p className="mono-label text-slate-500">AWARDED TO</p>
                  <p className="mt-2 text-2xl sm:text-3xl font-semibold">Student name</p>
                  <p className="mt-1 text-slate-600">Bachelor of Computer Science</p>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-200">
                  <div>
                    <p className="mono-label text-slate-500">ISSUED BY</p>
                    <p className="mt-1 text-sm font-medium">Recognized institution</p>
                  </div>
                  <div>
                    <p className="mono-label text-slate-500">RECORD STATUS</p>
                    <p className="mt-1 text-sm font-medium text-emerald-800">Verified</p>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between gap-3">
                  <span className="mono-label text-slate-500">CERTIFICATE ID</span>
                  <span className="mono-label text-slate-800">CRD ···· 8F2A</span>
                </div>
              </div>
              <div className="hero-meta mt-3 flex items-center justify-between text-[0.68rem] mono-label">
                <span>PUBLIC VERIFICATION</span>
                <span>01 / 01</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10 sm:mb-12">
            <p className="eyebrow text-indigo-700">Built for trust</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold text-slate-900">A simple path from issue to proof.</h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Credora gives institutions and graduates one dependable place to manage academic credentials.
            </p>
          </div>

          <div className="grid md:grid-cols-3 border-y border-slate-200">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.article
                  key={feature.number}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`py-7 md:py-8 md:pr-8 ${index < features.length - 1 ? 'md:border-r border-slate-200' : ''} ${index > 0 ? 'md:pl-8 border-t md:border-t-0 border-slate-200' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="mono-label text-slate-400">{feature.number}</span>
                    <Icon className="w-5 h-5 text-indigo-700" aria-hidden="true" />
                  </div>
                  <h3 className="mt-6 text-lg font-semibold text-slate-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-9">
            <div>
              <p className="eyebrow text-indigo-700">How it works</p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-semibold text-slate-900">Four clear steps.</h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-slate-600">
              A credential stays easy to share, with its authenticity anchored to a record that can be checked later.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 border border-slate-200 bg-white rounded-xl overflow-hidden">
            {steps.map((step, index) => (
              <div key={step.number} className={`p-5 sm:p-6 ${index < steps.length - 1 ? 'lg:border-r border-b lg:border-b-0 border-slate-200' : ''}`}>
                <span className="mono-label text-indigo-700">STEP {step.number}</span>
                <h3 className="mt-5 text-xl font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <p className="eyebrow text-indigo-700">Start with a record</p>
            <h2 className="mt-3 text-2xl sm:text-3xl font-semibold text-slate-900">Ready to issue or verify?</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/verify" className="btn-secondary">Check a certificate</Link>
            {!authLoading && (!isAuthenticated || workspacePath) && (
              <Link to={primaryPath} className="btn-primary">{primaryLabel} <FiArrowRight /></Link>
            )}
          </div>
        </div>
      </section>

      <footer className="mt-auto bg-slate-900 text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 flex flex-col sm:flex-row items-center justify-between gap-5">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Credora home">
            <span className="brand-mark" aria-hidden="true" />
            <span className="text-white font-semibold tracking-wide">CREDORA</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm" aria-label="Footer navigation">
            <Link to="/verify" className="hover:text-white transition-colors">Verify</Link>
            {!isAuthenticated && !authLoading && (
              <>
                <Link to="/login" className="hover:text-white transition-colors">Sign in</Link>
                <Link to="/register" className="hover:text-white transition-colors">Register</Link>
              </>
            )}
          </nav>
          <p className="footer-product-note mono-label">PUBLIC PROOF · REVOCATION STATUS</p>
        </div>
      </footer>
    </div>
  );
}
