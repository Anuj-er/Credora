import { motion } from 'framer-motion';

const accents = {
  blue: 'var(--glitch-cyan)',
  green: '#83dfa6',
  red: 'var(--glitch-coral)',
  yellow: 'var(--glitch-lime)',
  purple: 'var(--signal-violet)',
};

export default function StatsCard({ title, value, icon, color = 'blue', subtitle }) {
  const accent = accents[color] || accents.blue;
  const renderIcon = () => {
    if (!icon) return null;
    if (typeof icon === 'function') {
      const Icon = icon;
      return <Icon aria-hidden="true" />;
    }
    return icon;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="metric-card"
      style={{ '--metric-accent': accent, color: accent }}
    >
      <div className="metric-head">
        <p className="metric-label">{title}</p>
        <span className="metric-icon">{renderIcon()}</span>
      </div>
      <p className="metric-value">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </motion.div>
  );
}
