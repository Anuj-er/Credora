import { motion } from 'framer-motion';

// Colour names are the actual theme tokens, not generic colour words.
const accents = {
  cyan: 'var(--glitch-cyan)',
  green: 'var(--glitch-green)',
  coral: 'var(--glitch-coral)',
  lime: 'var(--glitch-lime)',
  violet: 'var(--signal-violet)',
};

export default function StatsCard({ title, value, icon, color = 'cyan', subtitle }) {
  const accent = accents[color] || accents.cyan;
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
