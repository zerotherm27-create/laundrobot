export const STATUS_COLORS = {
  'NEW ORDER':    '#38a9c2',
  'FOR PICK UP':  '#BA7517',
  'PROCESSING':   '#7F77DD',
  'FOR DELIVERY': '#1D9E75',
  'COMPLETED':    '#639922',
};

export const STATUS_BG = {
  'NEW ORDER':    '#e6f5f8',
  'FOR PICK UP':  '#FAEEDA',
  'PROCESSING':   '#EEEDFE',
  'FOR DELIVERY': '#E1F5EE',
  'COMPLETED':    '#EAF3DE',
};

export function StatusBadge({ status }) {
  return (
    <span style={{
      fontSize: 11,
      padding: '2px 8px',
      borderRadius: 4,
      fontWeight: 500,
      background: STATUS_BG[status] || '#eee',
      color: STATUS_COLORS[status] || '#555',
    }}>
      {status}
    </span>
  );
}