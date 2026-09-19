import { Icon } from './Icons.jsx';

// Phone-only bottom nav for the 4 highest-traffic sheets. The existing
// hamburger + sidebar drawer stays as "More" rather than duplicating the
// full NAV a second time. Visibility is CSS-driven (`.bottom-tab-bar` in
// index.html, same 767px breakpoint as the mobile topbar/drawer) so it
// always matches that cutoff instead of tracking it separately in JS.
const TABS = [
  { key: 'Overview',  iconName: 'overview',  label: 'Overview' },
  { key: 'Kanban',    iconName: 'kanban',    label: 'Board' },
  { key: 'Orders',    iconName: 'orders',    label: 'Orders' },
  { key: 'Customers', iconName: 'customers', label: 'Customers' },
];

export default function BottomTabBar({ current, onNav, onMore }) {
  return (
    <nav className="bottom-tab-bar" aria-label="Primary">
      {TABS.map(t => (
        <button
          key={t.key}
          onClick={() => onNav(t.key)}
          className={`bottom-tab-item${current === t.key ? ' active' : ''}`}
          aria-current={current === t.key ? 'page' : undefined}
        >
          <Icon name={t.iconName} size={19} color={current === t.key ? 'var(--primary)' : '#6B7280'} />
          <span>{t.label}</span>
        </button>
      ))}
      <button onClick={onMore} className="bottom-tab-item" aria-label="More">
        <span aria-hidden style={{ fontSize: 19, lineHeight: 1 }}>⋯</span>
        <span>More</span>
      </button>
    </nav>
  );
}
