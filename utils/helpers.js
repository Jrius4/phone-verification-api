export const e164 = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (s.startsWith('+')) return s.replace(/\s+/g, '');
    const digits = s.replace(/\D/g, '');
    if (digits.length === 10 && digits[0] === '0') return `+256${digits.slice(1)}`;
    if (digits && !digits.startsWith('0')) return `+256${digits}`;
    return `+${digits}`;
};