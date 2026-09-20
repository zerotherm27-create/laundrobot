import { Icon } from './Icons.jsx';
import { NAV, isNavVisible } from './Sidebar.jsx';

// Most-used sheets get a fixed slot on the native-style mobile tab bar; a
// "More" tab opens the existing sidebar drawer instead of duplicating NAV
// in a second menu. Hidden on desktop/tablet via CSS (mobile-only, <768px —
// same breakpoint the sidebar drawer already switches on).
const TAB_KEYS = ['Overview', 'Kanban', 'Orders', 'WalkIn'];

export default function BottomTabBar({ current, role, user, navOpen, onNav, onMore }) {
  const tabs = TAB_KEYS
    .map(key => NAV.find(n => n.key === key))
    .filter(n => n && isNavVisible(n.key, role, user));

  if (tabs.length === 0) return null;

  return (
    <nav className="bottom-tab-bar" aria-label="Primary sections">
      {tabs.map(({ key, iconName, label }) => (
        <button
          key={key}
          type="button"
          className={`bottom-tab-item${current === key ? ' active' : ''}`}
          onClick={() => onNav(key)}
          aria-current={current === key ? 'page' : undefined}
        >
          <Icon name={iconName} size={20} color={current === key ? 'var(--primary)' : '#6B7280'} />
          <span>{label}</span>
        </button>
      ))}
      <button
        type="button"
        className={`bottom-tab-item${navOpen ? ' active' : ''}`}
        onClick={onMore}
        aria-label="More sections"
      >
        <Icon name="menu" size={20} color={navOpen ? 'var(--primary)' : '#6B7280'} />
        <span>More</span>
      </button>
    </nav>
  );
}
