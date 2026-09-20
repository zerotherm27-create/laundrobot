import { Icon } from './Icons.jsx';
import { NAV, isNavVisible } from './Sidebar.jsx';

// Most-used sheets get a fixed slot on the native-style mobile tab bar; a
// "More" tab opens the existing sidebar drawer instead of duplicating NAV
// in a second menu. Hidden on desktop/tablet via CSS (mobile-only, <768px —
// same breakpoint the sidebar drawer already switches on).
// Icon-only, no text labels — Instagram-style minimal bottom nav rather than
// the labeled-icon pattern most native tab bars use.
const TAB_KEYS = ['Overview', 'Kanban', 'Orders', 'WalkIn'];

export default function BottomTabBar({ current, role, user, navOpen, onNav, onMore }) {
  const tabs = TAB_KEYS
    .map(key => NAV.find(n => n.key === key))
    .filter(n => n && isNavVisible(n.key, role, user));

  if (tabs.length === 0) return null;

  return (
    <nav className="bottom-tab-bar" aria-label="Primary sections">
      {tabs.map(({ key, iconName, label }) => {
        const active = current === key;
        return (
          <button
            key={key}
            type="button"
            className={`bottom-tab-item${active ? ' active' : ''}`}
            onClick={() => onNav(key)}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
          >
            <Icon name={iconName} size={26} strokeWidth={active ? 2.1 : 1.5} color={active ? '#111827' : '#8E8E8E'} />
          </button>
        );
      })}
      <button
        type="button"
        className={`bottom-tab-item${navOpen ? ' active' : ''}`}
        onClick={onMore}
        aria-label="More sections"
      >
        <Icon name="menu" size={26} strokeWidth={navOpen ? 2.1 : 1.5} color={navOpen ? '#111827' : '#8E8E8E'} />
      </button>
    </nav>
  );
}
