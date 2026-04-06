export function Avatar({ name = '?', size = 32, bg = '#E6F1FB', color = '#185FA5' }) {
  const initials = name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: bg,
      color: color,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.38,
      fontWeight: 500,
    }}>
      {initials}
    </div>
  );
}