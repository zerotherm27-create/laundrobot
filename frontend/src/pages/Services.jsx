import { useEffect, useState, useRef } from 'react';
import { getServices, createService, updateService, deleteService,
         getCategories, createCategory, updateCategory, deleteCategory } from '../api.js';

const emptyService  = { name: '', price: '', unit: '', description: '', active: true, image_url: '', category_id: '', sort_order: 0, turnaround_days: 2, available_online: true };

const LAUNDRY_ICONS = [
  { id: 'washing-machine', label: 'Washing machine', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="36" height="40" rx="4"/><circle cx="24" cy="28" r="10"/><circle cx="24" cy="28" r="5"/><circle cx="13" cy="11" r="2" fill="currentColor" stroke="none"/><circle cx="20" cy="11" r="2" fill="currentColor" stroke="none"/><line x1="28" y1="11" x2="36" y2="11"/></svg>` },
  { id: 'dryer', label: 'Dryer', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="36" height="40" rx="4"/><circle cx="24" cy="28" r="10"/><path d="M18 28 Q21 22 24 28 Q27 34 30 28"/><circle cx="13" cy="11" r="2" fill="currentColor" stroke="none"/><line x1="20" y1="11" x2="36" y2="11"/></svg>` },
  { id: 'tshirt', label: 'T-shirt', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 6 Q18 12 24 12 Q30 12 32 6L42 14L36 20V42H12V20L6 14Z"/></svg>` },
  { id: 'dress', label: 'Dress', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 4 Q18 10 24 10 Q30 10 30 4"/><path d="M18 4L8 20H18L12 44H36L30 20H40L30 4"/></svg>` },
  { id: 'pants', label: 'Pants', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6H40V18L28 44H22L18 26L14 44H8L10 18"/><line x1="8" y1="6" x2="40" y2="6"/><line x1="18" y1="26" x2="28" y2="26"/></svg>` },
  { id: 'jacket', label: 'Jacket / Coat', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 4L8 12V22H14V42H34V22H40V12L31 4"/><path d="M17 4 Q20 10 24 10 Q28 10 31 4"/><path d="M17 4L14 18"/><path d="M31 4L34 18"/><line x1="24" y1="10" x2="24" y2="42"/></svg>` },
  { id: 'socks', label: 'Socks', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H28V26L38 34A6 6 0 0 1 30 44H20A8 8 0 0 1 12 36V4"/><line x1="12" y1="12" x2="28" y2="12"/><line x1="12" y1="18" x2="28" y2="18"/></svg>` },
  { id: 'underwear', label: 'Underwear', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8H42L36 28H30 Q24 18 18 28H12Z"/><line x1="6" y1="8" x2="42" y2="8"/></svg>` },
  { id: 'towel', label: 'Towel', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="14" width="32" height="26" rx="3"/><path d="M16 14V10A8 4 0 0 1 32 10V14"/><line x1="8" y1="22" x2="40" y2="22"/><line x1="8" y1="30" x2="40" y2="30"/></svg>` },
  { id: 'bed-sheet', label: 'Bed sheet', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="10" width="36" height="28" rx="3"/><path d="M6 18H42"/><path d="M14 18V38"/><path d="M6 26H14"/></svg>` },
  { id: 'pillow', label: 'Pillow / Pillowcase', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="12" width="36" height="24" rx="12"/><ellipse cx="24" cy="24" rx="10" ry="7"/></svg>` },
  { id: 'blanket', label: 'Blanket / Duvet', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="8" width="36" height="32" rx="3"/><line x1="6" y1="16" x2="42" y2="16"/><path d="M18 8V16"/><path d="M30 8V16"/><path d="M14 22 Q18 26 22 22 Q26 18 30 22 Q34 26 38 22"/><path d="M14 30 Q18 34 22 30 Q26 26 30 30 Q34 34 38 30"/></svg>` },
  { id: 'curtains', label: 'Curtains', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="8" x2="44" y2="8"/><path d="M10 8 Q8 24 14 44"/><path d="M38 8 Q40 24 34 44"/><path d="M10 8 Q16 14 24 10 Q32 14 38 8"/><line x1="22" y1="10" x2="22" y2="44"/><line x1="26" y1="10" x2="26" y2="44"/></svg>` },
  { id: 'iron', label: 'Iron', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 28H36 Q44 28 44 22V18H28 Q20 18 16 24L6 28Z"/><rect x="28" y="14" width="8" height="4" rx="1"/><circle cx="16" cy="36" r="1.5" fill="currentColor" stroke="none"/><circle cx="24" cy="36" r="1.5" fill="currentColor" stroke="none"/><circle cx="32" cy="36" r="1.5" fill="currentColor" stroke="none"/><line x1="6" y1="28" x2="6" y2="40"/></svg>` },
  { id: 'hanger', label: 'Dry cleaning / Hanger', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M24 8 A4 4 0 0 1 28 12 Q28 16 24 18 L8 30 Q4 32 6 36 Q8 40 12 40H36 Q40 40 42 36 Q44 32 40 30L24 18"/><circle cx="24" cy="6" r="2"/></svg>` },
  { id: 'laundry-bag', label: 'Laundry bag', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14 Q10 16 10 22V38 Q10 44 16 44H32 Q38 44 38 38V22 Q38 16 34 14"/><path d="M18 14 Q18 8 24 8 Q30 8 30 14"/><path d="M14 14H34"/><path d="M16 28 Q20 24 24 28 Q28 32 32 28"/></svg>` },
  { id: 'basket', label: 'Laundry basket', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22H40L36 42H12Z"/><path d="M4 22H44"/><path d="M16 22L20 10"/><path d="M24 22V10"/><path d="M32 22L28 10"/><path d="M14 30H34"/><path d="M13 36H35"/></svg>` },
  { id: 'handwash', label: 'Hand wash', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 30 Q8 22 14 18L20 16V8 A2 2 0 0 1 24 8V20"/><path d="M24 20 L28 18 A2 2 0 0 1 30 22V24"/><path d="M30 24 L32 22 A2 2 0 0 1 34 26V28"/><path d="M34 28 L36 26 A2 2 0 0 1 38 30L36 36 Q32 42 24 42H18 Q12 42 10 36V30"/></svg>` },
  { id: 'shoes', label: 'Shoes', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 32 Q4 26 12 24L22 22 Q28 20 32 14L36 8 Q40 8 42 14 Q44 20 40 24L36 26H42 Q44 32 40 36H8 Q4 36 4 32Z"/><path d="M22 22 Q24 28 20 30"/></svg>` },
  { id: 'sneakers', label: 'Sneakers', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 30 Q4 24 10 22H20L28 12 Q30 10 34 12L30 22H42 Q46 26 44 32H8 Q4 34 4 30Z"/><path d="M20 22L18 30"/><path d="M26 20L24 30"/><line x1="4" y1="34" x2="44" y2="34"/></svg>` },
  { id: 'detergent', label: 'Detergent', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="16" width="24" height="28" rx="3"/><path d="M16 16V12 Q16 8 20 8H24 Q26 8 26 10V16"/><path d="M26 10H32 Q34 10 34 12V16"/><circle cx="24" cy="30" r="5"/><path d="M22 28 Q24 26 26 28"/></svg>` },
  { id: 'softener', label: 'Fabric softener', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 10 Q14 6 24 6 Q34 6 32 10"/><path d="M16 10 Q12 12 12 18V38 Q12 44 24 44 Q36 44 36 38V18 Q36 12 32 10"/><path d="M18 24 Q21 20 24 24 Q27 28 30 24"/><path d="M18 32 Q21 28 24 32 Q27 36 30 32"/></svg>` },
  { id: 'folded', label: 'Folded clothes', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="28" width="32" height="8" rx="2"/><rect x="10" y="20" width="28" height="8" rx="2"/><rect x="12" y="12" width="24" height="8" rx="2"/><rect x="6" y="36" width="36" height="6" rx="2"/></svg>` },
  { id: 'clothesline', label: 'Clothesline', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="12" x2="46" y2="12"/><path d="M14 12L14 14 Q10 16 10 20V30 Q10 32 14 32H20 Q24 32 24 28V14"/><circle cx="13" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="21" cy="12" r="1.5" fill="currentColor" stroke="none"/><path d="M34 12V14 Q34 18 32 22 Q30 26 32 30 Q33 32 36 32"/><path d="M40 12V14 Q40 18 42 22 Q44 26 42 30 Q41 32 38 32"/><circle cx="33" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="41" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>` },
  { id: 'stain', label: 'Stain removal', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="28" r="14"/><path d="M24 14 Q24 8 24 6"/><path d="M20 10 Q22 6 24 6 Q26 6 28 10"/><path d="M16 32 Q20 28 24 32 Q28 36 32 32"/><path d="M18 26 Q21 23 24 26"/></svg>` },
  { id: 'gloves', label: 'Gloves', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 42V20 A4 4 0 0 1 18 20V26"/><path d="M18 26V16 A3 3 0 0 1 24 16V22"/><path d="M24 22V18 A3 3 0 0 1 30 18V24"/><path d="M30 24V20 A3 3 0 0 1 36 20V30 Q36 40 28 42H14 Q10 42 10 38"/></svg>` },
  { id: 'baby', label: 'Baby clothes', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 Q18 12 24 12 Q30 12 30 6"/><path d="M18 6L10 14V20H16V38H32V20H38V14L30 6"/><path d="M22 24 Q24 22 26 24"/><path d="M22 28 Q24 30 26 28"/></svg>` },
  { id: 'suit', label: 'Suit / Formal wear', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 4L8 14V42H40V14L31 4"/><path d="M17 4L20 14L24 10L28 14L31 4"/><path d="M20 14L24 42"/><path d="M28 14L24 42"/><path d="M24 18V22"/><path d="M24 26V30"/></svg>` },
  { id: 'helmet', label: 'Helmet', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 26 Q8 10 24 10 Q40 10 40 26V30H34 Q32 36 28 38H20 Q16 36 14 30H8Z"/><path d="M8 30 Q6 32 6 34 Q6 38 10 38H14"/><path d="M15 22 Q18 18 24 18 Q30 18 33 22"/><line x1="8" y1="30" x2="40" y2="30"/></svg>` },
  { id: 'motorcycle-jacket', label: 'Biker jacket', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4L6 10V20H14V42H34V20H42V10L32 4"/><path d="M16 4 Q18 12 24 12 Q30 12 32 4"/><path d="M14 20 Q10 22 8 28"/><path d="M34 20 Q38 22 40 28"/><path d="M18 20 Q20 16 24 16 Q28 16 30 20"/><line x1="24" y1="12" x2="24" y2="42"/></svg>` },
  { id: 'school-uniform', label: 'School uniform', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 4L8 12V20H16V42H32V20H40V12L31 4"/><path d="M17 4 Q18 10 24 10 Q30 10 31 4"/><path d="M21 10L24 42"/><path d="M27 10L24 42"/><circle cx="24" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="24" cy="22" r="1.5" fill="currentColor" stroke="none"/><circle cx="24" cy="28" r="1.5" fill="currentColor" stroke="none"/></svg>` },
  { id: 'scrubs', label: 'Medical scrubs', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4L8 12V20H14V42H34V20H40V12L32 4"/><path d="M16 4 Q18 10 24 10 Q30 10 32 4"/><rect x="20" y="18" width="8" height="6" rx="1"/><line x1="24" y1="18" x2="24" y2="24"/><line x1="20" y1="21" x2="28" y2="21"/></svg>` },
  { id: 'cap', label: 'Cap / Hat', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 26 Q10 14 24 14 Q38 14 38 26"/><path d="M6 30 Q6 26 10 26H38 Q42 26 42 30 Q42 32 38 32H10 Q6 32 6 30Z"/><path d="M38 32 Q42 32 44 34"/><line x1="24" y1="14" x2="24" y2="8"/><circle cx="24" cy="7" r="2"/></svg>` },
  { id: 'tie', label: 'Necktie', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 6H29L26 18L30 42L24 46L18 42L22 18Z"/><path d="M19 6 Q20 10 22 10H26 Q28 10 29 6"/></svg>` },
  { id: 'scarf', label: 'Scarf', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10 Q16 6 24 10 Q32 14 40 10"/><path d="M40 10 Q36 16 40 22 Q44 28 40 34 Q36 40 30 40L28 44"/><path d="M8 10 Q10 16 8 22 Q6 28 10 34 Q14 38 18 38 Q20 38 22 36"/><line x1="8" y1="18" x2="40" y2="18"/></svg>` },
  { id: 'bag', label: 'Bag / Purse', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="18" width="32" height="24" rx="3"/><path d="M16 18V14 Q16 8 24 8 Q32 8 32 14V18"/><line x1="8" y1="28" x2="40" y2="28"/><circle cx="24" cy="23" r="2"/></svg>` },
  { id: 'apron', label: 'Apron', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 6H32"/><path d="M20 6 Q18 10 14 12V42H34V12 Q30 10 28 6"/><path d="M14 22H34"/><rect x="20" y="28" width="8" height="8" rx="1"/><line x1="16" y1="6" x2="10" y2="4"/><line x1="32" y1="6" x2="38" y2="4"/></svg>` },
  { id: 'sportswear', label: 'Sportswear', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4L8 14V20H14V42H34V20H40V14L32 4"/><path d="M16 4 Q18 10 24 10 Q30 10 32 4"/><path d="M8 17 Q12 15 14 20"/><path d="M40 17 Q36 15 34 20"/><line x1="14" y1="26" x2="34" y2="26"/><line x1="14" y1="32" x2="34" y2="32"/></svg>` },
];

function svgToDataUri(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const emptyCategory = { name: '', sort_order: 0, active: true };
const emptyField = { label: '', field_type: 'text', placeholder: '', required: false, allow_own: false, sync_qty: false, linked_to_field_label: '', linked_to_value: '', options: [], min_value: '', max_value: '', unit_price: '', _newOption: '', _newOptionPrice: '', _newOptionPriceType: 'fixed', _newOptionTurnaround: '' };

const FIELD_TYPES = [
  { value: 'text',     label: 'Short text' },
  { value: 'textarea', label: 'Notes / Long text' },
  { value: 'number',   label: 'Number (qty multiplier)' },
  { value: 'select',   label: 'Variation (select one)' },
  { value: 'addon',    label: 'Add-on (with price)' },
];

export default function Services() {
  const [categories,    setCategories]    = useState([]);
  const [services,      setServices]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [svcForm,       setSvcForm]       = useState(null);
  const [catForm,       setCatForm]       = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [preview,       setPreview]       = useState(null);
  const [imgTab,        setImgTab]        = useState('icon'); // 'icon' | 'upload'
  const [fields,        setFields]        = useState([]);     // custom fields for open service
  const [dragOverSvcId, setDragOverSvcId] = useState(null);
  const [dragOverCatId, setDragOverCatId] = useState(null);
  const dragRef = useRef({}); // { type: 'svc'|'cat', id, catKey }
  const fileRef = useRef();

  // ── Drag handlers — services ──────────────────────────────────────────
  function handleSvcDragStart(e, svc) {
    dragRef.current = { type: 'svc', id: svc.id, catKey: svc.category_id ? String(svc.category_id) : '__none__' };
    e.dataTransfer.effectAllowed = 'move';
  }
  function handleSvcDragOver(e, svc) {
    e.preventDefault();
    if (dragRef.current.type === 'svc' && dragOverSvcId !== svc.id) setDragOverSvcId(svc.id);
  }
  function handleSvcDrop(e, targetSvc) {
    e.preventDefault();
    const { id: fromId, catKey } = dragRef.current;
    dragRef.current = {};
    setDragOverSvcId(null);
    if (!fromId || fromId === targetSvc.id) return;

    setServices(prev => {
      const catSvcs = [...prev]
        .filter(s => (s.category_id ? String(s.category_id) : '__none__') === catKey)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const others = prev.filter(s => (s.category_id ? String(s.category_id) : '__none__') !== catKey);
      const fromIdx = catSvcs.findIndex(s => s.id === fromId);
      const toIdx   = catSvcs.findIndex(s => s.id === targetSvc.id);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const reordered = [...catSvcs];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      const updated = reordered.map((s, i) => ({ ...s, sort_order: i }));
      // Save changed rows — spread full object so PUT doesn't wipe name/price/etc.
      updated.forEach(s => {
        const orig = catSvcs.find(x => x.id === s.id);
        if (!orig || orig.sort_order !== s.sort_order) {
          updateService(s.id, { ...s }).catch(() => {});
        }
      });
      return [...others, ...updated];
    });
  }

  // ── Drag handlers — categories ────────────────────────────────────────
  function handleCatDragStart(e, cat) {
    dragRef.current = { type: 'cat', id: cat.id };
    e.dataTransfer.effectAllowed = 'move';
  }
  function handleCatDragOver(e, cat) {
    e.preventDefault();
    if (dragRef.current.type === 'cat' && dragOverCatId !== cat.id) setDragOverCatId(cat.id);
  }
  function handleCatDrop(e, targetCat) {
    e.preventDefault();
    const { id: fromId } = dragRef.current;
    dragRef.current = {};
    setDragOverCatId(null);
    if (!fromId || fromId === targetCat.id) return;

    setCategories(prev => {
      const sorted = [...prev].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const fromIdx = sorted.findIndex(c => c.id === fromId);
      const toIdx   = sorted.findIndex(c => c.id === targetCat.id);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const reordered = [...sorted];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      const updated = reordered.map((c, i) => ({ ...c, sort_order: i }));
      // Save only changed rows — pass full object so PUT doesn't wipe the name
      updated.forEach(c => {
        if (sorted.find(x => x.id === c.id)?.sort_order !== c.sort_order) {
          updateCategory(c.id, { ...c }).catch(() => {});
        }
      });
      return updated;
    });
  }
  function handleDragEnd() {
    setDragOverSvcId(null);
    setDragOverCatId(null);
    dragRef.current = {};
  }

  useEffect(() => {
    Promise.all([getServices(), getCategories()])
      .then(([s, c]) => { setServices(s.data); setCategories(c.data); })
      .finally(() => setLoading(false));
  }, []);

  // ── Image upload ──────────────────────────────────────────────────────
  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setPreview(ev.target.result);
      setSvcForm(p => ({ ...p, image_url: ev.target.result }));
    };
    reader.readAsDataURL(file);
  }

  // ── Open service modal ────────────────────────────────────────────────
  function openSvc(svc) {
    setSvcForm({ ...svc, isNew: false });
    setPreview(svc.image_url || null);
    setImgTab(svc.image_url && !svc.image_url.startsWith('data:image/svg') ? 'upload' : 'icon');
    setFields((svc.custom_fields || []).map(f => ({
      ...f,
      options:    Array.isArray(f.options) ? f.options.map(o => typeof o === 'object' && o !== null ? { price_type: 'fixed', ...o } : { label: String(o), price: 0, price_type: 'fixed' }) : [],
      min_value:  f.min_value ?? '',
      max_value:  f.max_value ?? '',
      unit_price: f.unit_price ?? '',
      _newOption: '',
      _newOptionPrice: '',
      _newOptionPriceType: 'fixed',
      _newOptionTurnaround: '',
    })));
  }

  function openNewSvc(overrides = {}) {
    setSvcForm({ ...emptyService, isNew: true, ...overrides });
    setPreview(null);
    setImgTab('icon');
    setFields([]);
  }

  // ── Custom fields helpers ─────────────────────────────────────────────
  function addField() {
    setFields(prev => [...prev, { ...emptyField, _key: Date.now() }]);
  }

  function updateField(idx, key, val) {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f));
  }

  function removeField(idx) {
    setFields(prev => prev.filter((_, i) => i !== idx));
  }

  function moveField(idx, dir) {
    setFields(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  }

  function addOption(fieldIdx) {
    setFields(prev => prev.map((f, i) => {
      if (i !== fieldIdx) return f;
      const label = (f._newOption || '').trim();
      const reset = { _newOption: '', _newOptionPrice: '', _newOptionPriceType: 'fixed', _newOptionTurnaround: '' };
      if (!label) return { ...f, ...reset };
      const existingLabels = (f.options || []).map(o => typeof o === 'object' ? o.label : o);
      if (existingLabels.includes(label)) return { ...f, ...reset };
      const priceType = f._newOptionPriceType || 'fixed';
      const price = priceType === 'copy_base' ? 0 : (parseFloat(f._newOptionPrice) || 0);
      const td = f._newOptionTurnaround !== '' ? parseInt(f._newOptionTurnaround) || null : null;
      const newOpt = { label, price, price_type: priceType, ...(td != null ? { turnaround_days: td } : {}) };
      return { ...f, options: [...(f.options || []), newOpt], ...reset };
    }));
  }

  function removeOption(fieldIdx, optIdx) {
    setFields(prev => prev.map((f, i) =>
      i === fieldIdx ? { ...f, options: (f.options || []).filter((_, oi) => oi !== optIdx) } : f
    ));
  }

  function startEditOption(fieldIdx, optIdx) {
    setFields(prev => prev.map((f, i) => {
      if (i !== fieldIdx) return f;
      const opt = f.options[optIdx];
      const label = typeof opt === 'object' ? opt.label : String(opt);
      const price = typeof opt === 'object' ? opt.price : 0;
      const price_type = typeof opt === 'object' ? (opt.price_type || 'fixed') : 'fixed';
      const turnaround = typeof opt === 'object' && opt.turnaround_days != null ? String(opt.turnaround_days) : '';
      return { ...f, _editingOptIdx: optIdx, _editOptLabel: label, _editOptPrice: String(price), _editOptPriceType: price_type, _editOptTurnaround: turnaround };
    }));
  }

  function saveEditOption(fieldIdx) {
    setFields(prev => prev.map((f, i) => {
      if (i !== fieldIdx) return f;
      const label = (f._editOptLabel || '').trim();
      if (!label) return f;
      const priceType = f._editOptPriceType || 'fixed';
      const price = priceType === 'copy_base' ? 0 : (parseFloat(f._editOptPrice) || 0);
      const td = f._editOptTurnaround !== '' && f._editOptTurnaround != null ? parseInt(f._editOptTurnaround) || null : null;
      const newOptions = f.options.map((o, oi) =>
        oi === f._editingOptIdx ? { label, price, price_type: priceType, ...(td != null ? { turnaround_days: td } : {}) } : o
      );
      return { ...f, options: newOptions, _editingOptIdx: undefined, _editOptLabel: '', _editOptPrice: '', _editOptPriceType: 'fixed', _editOptTurnaround: '' };
    }));
  }

  function cancelEditOption(fieldIdx) {
    setFields(prev => prev.map((f, i) =>
      i === fieldIdx ? { ...f, _editingOptIdx: undefined, _editOptLabel: '', _editOptPrice: '', _editOptPriceType: 'fixed', _editOptTurnaround: '' } : f
    ));
  }

  function duplicateSvc(svc) {
    setSvcForm({ ...svc, name: svc.name + ' (Copy)', isNew: true, id: undefined });
    setPreview(svc.image_url || null);
    setImgTab(svc.image_url && !svc.image_url.startsWith('data:image/svg') ? 'upload' : 'icon');
    setFields((svc.custom_fields || []).map(f => ({
      ...f,
      _key: Date.now() + Math.random(),
      options: Array.isArray(f.options) ? f.options.map(o => ({ ...o })) : [],
      _newOption: '', _newOptionPrice: '', _newOptionPriceType: 'fixed', _newOptionTurnaround: '',
    })));
  }

  // ── Service save ──────────────────────────────────────────────────────
  async function handleSvcSave() {
    if (!svcForm.name || svcForm.price === '' || svcForm.price === null || svcForm.price === undefined) return alert('Name and price are required. Set 0 for variation-priced services.');
    // Validate custom fields
    for (const f of fields) {
      if (!f.label.trim()) return alert('All custom field labels must be filled in.');
    }
    setSaving(true);
    try {
      const payload = {
        ...svcForm,
        category_id: svcForm.category_id || null,
        custom_fields: fields.map((f, i) => ({ ...f, sort_order: i })),
      };
      if (svcForm.isNew) {
        const { data } = await createService(payload);
        setServices(prev => [...prev, data]);
      } else {
        const { data } = await updateService(svcForm.id, payload);
        setServices(prev => prev.map(s => s.id === svcForm.id ? data : s));
      }
      setSvcForm(null); setPreview(null); setFields([]);
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  }

  async function handleSvcDelete(id) {
    if (!confirm('Delete this service?')) return;
    await deleteService(id);
    setServices(prev => prev.filter(s => s.id !== id));
    setSvcForm(null); setFields([]);
  }

  // ── Category save ─────────────────────────────────────────────────────
  async function handleCatSave() {
    if (!catForm.name) return alert('Category name is required.');
    setSaving(true);
    try {
      if (catForm.isNew) {
        const { data } = await createCategory(catForm);
        setCategories(prev => [...prev, data]);
      } else {
        const { data } = await updateCategory(catForm.id, catForm);
        setCategories(prev => prev.map(c => c.id === catForm.id ? data : c));
      }
      setCatForm(null);
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  }

  async function handleCatDelete(id) {
    if (!confirm('Delete this category? Services in it will become uncategorized.')) return;
    await deleteCategory(id);
    setCategories(prev => prev.filter(c => c.id !== id));
    setServices(prev => prev.map(s => s.category_id === id ? { ...s, category_id: null, category_name: null } : s));
    setCatForm(null);
  }

  // ── Group services by category ────────────────────────────────────────
  const grouped = {};
  for (const s of services) {
    const key = s.category_id ? String(s.category_id) : '__none__';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  const sortedCats = [...categories].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));

  const sections = [
    ...sortedCats.map(c => ({ id: String(c.id), name: c.name, active: c.active, cat: c })),
    ...(grouped['__none__']?.length ? [{ id: '__none__', name: 'Uncategorized', active: true, cat: null }] : []),
  ];

  const S = {
    label:  { fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 },
    input:  { width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', outline: 'none' },
    select: { width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid #ccc', background: '#fff' },
    btn:    (bg, color) => ({ padding: '8px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: bg, color, border: 'none', fontWeight: 500, flex: 1 }),
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>Services & Pricing</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setCatForm({ ...emptyCategory, isNew: true }); }}
            style={{ padding: '7px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#f0f0ec', color: '#444', border: '0.5px solid #ccc', fontWeight: 500 }}>
            + Category
          </button>
          <button onClick={() => openNewSvc()}
            style={{ padding: '7px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#38a9c2', color: '#fff', border: 'none', fontWeight: 500 }}>
            + Service
          </button>
        </div>
      </div>

      {loading ? <div style={{ color: '#374151', fontSize: 14 }}>Loading...</div> : (

        sections.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#374151', fontSize: 14, padding: '3rem 0' }}>
            No services yet. Click <b>+ Category</b> to create a category, then <b>+ Service</b> to add services.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {sections.map(({ id, name, active, cat }) => {
              const svcList = (grouped[id] || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
              const isDragOverCat = dragOverCatId === cat?.id;
              return (
                <div key={id}
                  onDragOver={cat ? e => handleCatDragOver(e, cat) : undefined}
                  onDrop={cat ? e => handleCatDrop(e, cat) : undefined}
                  style={{ borderRadius: 10, padding: isDragOverCat ? '6px' : 0, background: isDragOverCat ? '#F0F9FF' : 'transparent', border: isDragOverCat ? '1.5px dashed #38a9c2' : '1.5px solid transparent', transition: 'all .15s' }}
                >
                  {/* Category header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    {/* Drag handle for category */}
                    {cat && (
                      <div
                        draggable
                        onDragStart={e => handleCatDragStart(e, cat)}
                        onDragEnd={handleDragEnd}
                        title="Drag to reorder category"
                        style={{ cursor: 'grab', color: '#9CA3AF', fontSize: 14, lineHeight: 1, userSelect: 'none', padding: '2px 4px', borderRadius: 4 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#6B7280'}
                        onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}
                      >⠿</div>
                    )}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#222' }}>{name}</span>
                      {!active && <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f0f0ec', color: '#374151' }}>Hidden</span>}
                      <span style={{ fontSize: 12, color: '#374151' }}>({svcList.length} service{svcList.length !== 1 ? 's' : ''})</span>
                    </div>
                    {cat && (
                      <button onClick={() => setCatForm({ ...cat, isNew: false })}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ddd', color: '#374151' }}>
                        Edit category
                      </button>
                    )}
                  </div>

                  {/* Services grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10 }}>
                    {svcList.map(s => {
                      const isOver = dragOverSvcId === s.id;
                      const isDragging = dragRef.current.id === s.id;
                      return (
                      <div key={s.id}
                        draggable
                        onDragStart={e => handleSvcDragStart(e, s)}
                        onDragOver={e => handleSvcDragOver(e, s)}
                        onDrop={e => handleSvcDrop(e, s)}
                        onDragEnd={handleDragEnd}
                        style={{ background: '#fff', border: isOver ? '2px solid #38a9c2' : '0.5px solid #e8e8e0', borderRadius: 10, overflow: 'hidden', opacity: isDragging ? 0.4 : (s.active ? 1 : 0.55), cursor: 'grab', transition: 'border-color .1s, opacity .1s', position: 'relative' }}
                      >
                        {/* Drag handle overlay */}
                        <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(255,255,255,0.85)', borderRadius: 4, padding: '1px 4px', fontSize: 13, color: '#9CA3AF', cursor: 'grab', lineHeight: 1, pointerEvents: 'none' }}>⠿</div>
                        {s.image_url
                          ? <img src={s.image_url} alt={s.name} style={{ width: '100%', height: 110, objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: 110, background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🧺</div>
                        }
                        <div style={{ padding: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 4 }}>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{s.name}</div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {!s.active && <span style={{ fontSize: 10, padding: '2px 5px', borderRadius: 3, background: '#f0f0ec', color: '#374151' }}>Off</span>}
                              {s.active && s.available_online === false && <span style={{ fontSize: 10, padding: '2px 5px', borderRadius: 3, background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>Walk-in only</span>}
                            </div>
                          </div>
                          {(() => {
                            const hasVarPricing = (s.custom_fields || []).some(f =>
                              f.field_type === 'select' &&
                              Array.isArray(f.options) &&
                              f.options.some(o => Number(typeof o === 'object' ? o.price : 0) > 0)
                            );
                            return hasVarPricing
                              ? <div style={{ fontSize: 13, fontWeight: 600, color: '#1a7d94', marginBottom: 2 }}>Prices vary by selection</div>
                              : <div style={{ fontSize: 18, fontWeight: 600, color: '#1a7d94', marginBottom: 2 }}>₱{Number(s.price).toLocaleString()} <span style={{ fontSize: 11, fontWeight: 400, color: '#374151' }}>{s.unit}</span></div>;
                          })()}
                          {s.description && <div style={{ fontSize: 11, color: '#374151', marginBottom: 8 }}>{s.description}</div>}
                          {s.custom_fields?.length > 0 && (
                            <div style={{ fontSize: 11, color: '#374151', marginBottom: 8 }}>
                              {s.custom_fields.length} custom field{s.custom_fields.length !== 1 ? 's' : ''}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openSvc(s)}
                              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ccc', color: '#374151', flex: 1 }}>
                              Edit
                            </button>
                            <button onClick={() => duplicateSvc(s)} title="Duplicate service"
                              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 5, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ccc', color: '#374151' }}>
                              ⎘
                            </button>
                          </div>
                        </div>
                      </div>
                      );
                    })}

                    {/* Add service to this category shortcut */}
                    <div
                      onClick={() => openNewSvc({ category_id: id === '__none__' ? '' : id })}
                      style={{ border: '1.5px dashed #111827', borderRadius: 10, minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#111827', fontSize: 13, flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 22 }}>+</span>
                      <span>Add service</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Service Modal ──────────────────────────────────────────────── */}
      {svcForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: 480, border: '0.5px solid #e8e8e0', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>{svcForm.isNew ? 'Add service' : 'Edit service'}</div>

            {/* Image */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Service image</label>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 10, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                {[['icon', 'Choose icon'], ['upload', 'Upload photo']].map(([tab, lbl]) => (
                  <button key={tab} onClick={() => setImgTab(tab)}
                    style={{ flex: 1, padding: '6px 0', fontSize: 12, fontWeight: imgTab === tab ? 600 : 400, background: imgTab === tab ? '#111' : '#fff', color: imgTab === tab ? '#fff' : '#374151', border: 'none', cursor: 'pointer', transition: 'all .15s' }}>
                    {lbl}
                  </button>
                ))}
              </div>

              {imgTab === 'icon' ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                    {LAUNDRY_ICONS.map(icon => {
                      const uri = svgToDataUri(icon.svg);
                      const selected = preview === uri;
                      return (
                        <button key={icon.id} title={icon.label}
                          onClick={() => { setPreview(uri); setSvcForm(p => ({ ...p, image_url: uri })); }}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 4px', borderRadius: 8, border: selected ? '2px solid #111' : '1.5px solid #e5e7eb', background: selected ? '#f4f4f0' : '#fafafa', cursor: 'pointer', transition: 'all .12s' }}>
                          <img src={uri} alt={icon.label} style={{ width: 28, height: 28 }} />
                          <span style={{ fontSize: 9, color: '#6B7280', textAlign: 'center', lineHeight: 1.2 }}>{icon.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {preview && preview.startsWith('data:image/svg') && (
                    <button onClick={() => { setPreview(null); setSvcForm(p => ({ ...p, image_url: '' })); }}
                      style={{ marginTop: 6, fontSize: 11, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>Clear selection</button>
                  )}
                </div>
              ) : (
                <div>
                  <div onClick={() => fileRef.current.click()}
                    style={{ width: '100%', height: 110, borderRadius: 8, border: '1px dashed #ccc', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f9f9' }}>
                    {preview && !preview.startsWith('data:image/svg')
                      ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ textAlign: 'center', color: '#374151' }}><div style={{ fontSize: 24, marginBottom: 4 }}>📷</div><div style={{ fontSize: 11 }}>Click to upload</div></div>}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                  {preview && !preview.startsWith('data:image/svg') && (
                    <button onClick={() => { setPreview(null); setSvcForm(p => ({ ...p, image_url: '' })); }}
                      style={{ marginTop: 4, fontSize: 11, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>Remove image</button>
                  )}
                </div>
              )}
            </div>

            {/* Category */}
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Category</label>
              <select value={svcForm.category_id || ''} onChange={e => setSvcForm(p => ({ ...p, category_id: e.target.value }))} style={S.select}>
                <option value="">— Uncategorized —</option>
                {sortedCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Core fields */}
            {[['name','Service name','text'],['price','Price (₱)','number'],['unit','Unit (e.g. per kg, per piece)','text'],['description','Description (optional)','text']].map(([field, label, type]) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={S.label}>{label}</label>
                <input type={type} value={svcForm[field]} onChange={e => setSvcForm(p => ({ ...p, [field]: e.target.value }))} style={S.input} />
              </div>
            ))}

            {/* Turnaround days */}
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Turnaround time (days) <span style={{ fontWeight: 400, color: '#6B7280' }}>— how long until delivery after pickup</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="number" min="1" max="30" value={svcForm.turnaround_days ?? 2}
                  onChange={e => setSvcForm(p => ({ ...p, turnaround_days: +e.target.value }))} style={{ ...S.input, width: 80 }} />
                <span style={{ fontSize: 12, color: '#374151' }}>
                  day{(svcForm.turnaround_days ?? 2) !== 1 ? 's' : ''} after pickup → delivery date auto-calculated
                </span>
              </div>
            </div>

            {/* Sort order */}
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Sort order (lower = first)</label>
              <input type="number" value={svcForm.sort_order} onChange={e => setSvcForm(p => ({ ...p, sort_order: +e.target.value }))} style={S.input} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <input type="checkbox" id="svcActive" checked={svcForm.active} onChange={e => setSvcForm(p => ({ ...p, active: e.target.checked }))} />
              <label htmlFor="svcActive" style={{ fontSize: 13, cursor: 'pointer' }}>Active (visible to customers)</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '10px 12px', borderRadius: 8, background: (svcForm.available_online ?? true) ? '#F7F9FD' : '#FFF7ED', border: `1px solid ${(svcForm.available_online ?? true) ? '#E2E8F0' : '#FCD34D'}` }}>
              <input type="checkbox" id="svcOnline" checked={svcForm.available_online ?? true} onChange={e => setSvcForm(p => ({ ...p, available_online: e.target.checked }))} />
              <div>
                <label htmlFor="svcOnline" style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer', color: (svcForm.available_online ?? true) ? '#111827' : '#92400E' }}>
                  {(svcForm.available_online ?? true) ? 'Available for online booking' : 'Walk-in POS only'}
                </label>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                  {(svcForm.available_online ?? true)
                    ? 'Customers can book this via Messenger, web, or walk-in'
                    : 'Only visible in the Walk-in POS and New Order modal — hidden from public booking'}
                </div>
              </div>
            </div>

            {/* ── Custom Fields ──────────────────────────────────────── */}
            <div style={{ borderTop: '0.5px solid #eee', paddingTop: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Custom Fields</div>
                  <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>Extra info to collect when customers order this service</div>
                </div>
                <button onClick={addField}
                  style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, cursor: 'pointer', background: '#f0f0ec', border: '0.5px solid #ccc', color: '#444', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  + Add field
                </button>
              </div>

              {fields.length === 0 ? (
                <div style={{ fontSize: 12, color: '#374151', textAlign: 'center', padding: '14px 0', border: '1px dashed #eee', borderRadius: 8 }}>
                  No custom fields — click <b>+ Add field</b> to create one
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {fields.map((f, idx) => (
                    <div key={f._key ?? f.id ?? idx}
                      style={{ background: '#f9f9f7', border: '0.5px solid #e8e8e0', borderRadius: 8, padding: '10px 12px' }}>

                      {/* Row 1: label + type */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 8, marginBottom: 8 }}>
                        <div>
                          <label style={{ ...S.label, marginBottom: 3 }}>Field label</label>
                          <input value={f.label} onChange={e => updateField(idx, 'label', e.target.value)}
                            placeholder="e.g. Weight (kg), Color, Notes…"
                            style={{ ...S.input, fontSize: 12 }} />
                        </div>
                        <div>
                          <label style={{ ...S.label, marginBottom: 3 }}>Type</label>
                          <select value={f.field_type}
                            onChange={e => updateField(idx, 'field_type', e.target.value)}
                            style={{ ...S.select, fontSize: 12 }}>
                            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Type-specific config */}
                      {(f.field_type === 'text' || f.field_type === 'textarea') && (
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ ...S.label, marginBottom: 3 }}>Placeholder text (optional)</label>
                          <input value={f.placeholder || ''} onChange={e => updateField(idx, 'placeholder', e.target.value)}
                            placeholder={f.field_type === 'textarea' ? 'e.g. Any special instructions…' : 'e.g. Enter value here'}
                            style={{ ...S.input, fontSize: 12 }} />
                        </div>
                      )}

                      {f.field_type === 'number' && (
                        <>
                          <div style={{ marginBottom: 8 }}>
                            <label style={{ ...S.label, marginBottom: 3 }}>Placeholder text (optional)</label>
                            <input value={f.placeholder || ''} onChange={e => updateField(idx, 'placeholder', e.target.value)}
                              placeholder="e.g. Enter number of pieces" style={{ ...S.input, fontSize: 12 }} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                            <div>
                              <label style={{ ...S.label, marginBottom: 3 }}>Min value (optional)</label>
                              <input type="number" value={f.min_value || ''} onChange={e => updateField(idx, 'min_value', e.target.value)}
                                placeholder="0" style={{ ...S.input, fontSize: 12 }} />
                            </div>
                            <div>
                              <label style={{ ...S.label, marginBottom: 3 }}>Max value (optional)</label>
                              <input type="number" value={f.max_value || ''} onChange={e => updateField(idx, 'max_value', e.target.value)}
                                placeholder="—" style={{ ...S.input, fontSize: 12 }} />
                            </div>
                          </div>
                        </>
                      )}

                      {f.field_type === 'addon' && (
                        <>
                          <div style={{ marginBottom: 8 }}>
                            <label style={{ ...S.label, marginBottom: 3 }}>Add-on price (₱) per unit *</label>
                            <input type="number" min="0" step="0.01"
                              value={f.unit_price || ''}
                              onChange={e => updateField(idx, 'unit_price', e.target.value)}
                              placeholder="e.g. 10"
                              style={{ ...S.input, fontSize: 12 }} />
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <label style={{ ...S.label, marginBottom: 3 }}>Description / hint (optional)</label>
                            <input value={f.placeholder || ''}
                              onChange={e => updateField(idx, 'placeholder', e.target.value)}
                              placeholder="e.g. Wire hanger included"
                              style={{ ...S.input, fontSize: 12 }} />
                          </div>
                          <div style={{ fontSize: 11, padding: '6px 10px', borderRadius: 6, background: '#EAF3DE', color: '#3B6D11' }}>
                            ✓ Customer selects quantity (0, 1, 2…) — price added to order total
                          </div>

                          {/* Conditional visibility — link to a select field option */}
                          {(() => {
                            const selectFields = fields.filter((sf, si) => sf.field_type === 'select' && si !== idx && sf.label);
                            return selectFields.length > 0 && (
                              <div style={{ marginTop: 10, padding: '10px', background: '#F9F9F7', borderRadius: 7, border: '0.5px solid #e8e8e0' }}>
                                <label style={{ ...S.label, marginBottom: 4 }}>Show only when (optional)</label>
                                <select value={f.linked_to_field_label || ''} onChange={e => updateField(idx, 'linked_to_field_label', e.target.value)} style={{ ...S.select, fontSize: 12, marginBottom: 6 }}>
                                  <option value="">— Always show —</option>
                                  {selectFields.map(sf => (
                                    <option key={sf.label} value={sf.label}>{sf.label}</option>
                                  ))}
                                </select>
                                {f.linked_to_field_label && (
                                  <select value={f.linked_to_value || ''} onChange={e => updateField(idx, 'linked_to_value', e.target.value)} style={{ ...S.select, fontSize: 12 }}>
                                    <option value="">— Select trigger option —</option>
                                    {(fields.find(sf => sf.label === f.linked_to_field_label)?.options || []).map(opt => {
                                      const label = typeof opt === 'object' ? opt.label : opt;
                                      return <option key={label} value={label}>{label}</option>;
                                    })}
                                  </select>
                                )}
                              </div>
                            );
                          })()}

                          {f.field_type === 'addon' && (
                            <>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer', marginTop: 8 }}>
                                <input type="checkbox" checked={f.allow_own || false} onChange={e => updateField(idx, 'allow_own', e.target.checked)} />
                                Allow "I'll provide my own" option
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer', marginTop: 6 }}>
                                <input type="checkbox" checked={f.sync_qty || false} onChange={e => updateField(idx, 'sync_qty', e.target.checked)} />
                                Auto-fill quantity from piece count
                              </label>
                            </>
                          )}
                        </>
                      )}

                      {f.field_type === 'select' && (
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ ...S.label, marginBottom: 6 }}>Options &amp; prices</label>

                          {/* Existing options */}
                          {(f.options || []).length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                              {(f.options || []).map((opt, oi) => {
                                const optLabel  = typeof opt === 'object' ? opt.label : opt;
                                const optPrice  = typeof opt === 'object' ? Number(opt.price || 0) : 0;
                                const priceType = typeof opt === 'object' ? (opt.price_type || 'fixed') : 'fixed';
                                const isEditing = f._editingOptIdx === oi;
                                const optTurnaround = typeof opt === 'object' && opt.turnaround_days != null ? opt.turnaround_days : null;
                                if (isEditing) {
                                  return (
                                    <div key={oi} style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 10px', background: '#FFF9E6', borderRadius: 7, border: '1px solid #F5D165' }}>
                                      <div style={{ display: 'grid', gridTemplateColumns: `1fr ${(f._editOptPriceType || 'fixed') === 'copy_base' ? 'auto' : '80px'} 72px auto auto`, gap: 5, alignItems: 'center' }}>
                                        <input value={f._editOptLabel || ''} onChange={e => updateField(idx, '_editOptLabel', e.target.value)}
                                          style={{ ...S.input, fontSize: 12 }} placeholder="Option label" />
                                        {(f._editOptPriceType || 'fixed') === 'copy_base' ? (
                                          <span style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', fontSize: 11, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', borderRadius: 6, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                            = base price
                                          </span>
                                        ) : (
                                          <input type="number" min="0" step="1" value={f._editOptPrice || ''} onChange={e => updateField(idx, '_editOptPrice', e.target.value)}
                                            placeholder="₱ price" style={{ ...S.input, fontSize: 12 }} />
                                        )}
                                        <input type="number" min="1" max="30" step="1" value={f._editOptTurnaround || ''} onChange={e => updateField(idx, '_editOptTurnaround', e.target.value)}
                                          placeholder="⏱ days" title="Turnaround override (days)" style={{ ...S.input, fontSize: 12 }} />
                                        <button onClick={() => saveEditOption(idx)}
                                          style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, cursor: 'pointer', background: '#38a9c2', color: '#fff', border: 'none', fontWeight: 500 }}>✓</button>
                                        <button onClick={() => cancelEditOption(idx)}
                                          style={{ padding: '4px 8px', fontSize: 12, borderRadius: 5, cursor: 'pointer', background: '#f0f0ec', color: '#444', border: '0.5px solid #ccc' }}>✕</button>
                                      </div>
                                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <button type="button"
                                          onClick={() => updateField(idx, '_editOptPriceType', (f._editOptPriceType || 'fixed') === 'copy_base' ? 'fixed' : 'copy_base')}
                                          style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textAlign: 'left',
                                            color: (f._editOptPriceType || 'fixed') === 'copy_base' ? '#7C3AED' : '#374151', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                                          {(f._editOptPriceType || 'fixed') === 'copy_base' ? '↩ Switch to fixed price' : '= Switch to copy base price'}
                                        </button>
                                        <span style={{ fontSize: 11, color: '#6B7280' }}>⏱ = turnaround override (leave blank to use service default)</span>
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#e6f5f8', borderRadius: 7, border: '1px solid #9ed3dc' }}>
                                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#1a7d94' }}>{optLabel}</span>
                                    {priceType === 'copy_base' ? (
                                      <span style={{ fontSize: 11, color: '#7C3AED', background: '#F5F3FF', padding: '2px 8px', borderRadius: 4, border: '1px solid #DDD6FE', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                        = base price
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: 12, color: '#1a7d94', background: '#fff', padding: '2px 8px', borderRadius: 4, border: '1px solid #9ed3dc', fontWeight: 600 }}>
                                        ₱{optPrice.toLocaleString()}
                                      </span>
                                    )}
                                    {optTurnaround != null && (
                                      <span style={{ fontSize: 11, color: '#D97706', background: '#FEF3C7', padding: '2px 7px', borderRadius: 4, border: '1px solid #FCD34D', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                        ⏱ {optTurnaround}d
                                      </span>
                                    )}
                                    <button onClick={() => startEditOption(idx, oi)} title="Edit option"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#374151', fontSize: 13, padding: '0 2px', lineHeight: 1 }}>✎</button>
                                    <button onClick={() => removeOption(idx, oi)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A32D2D', fontSize: 15, padding: '0 2px', lineHeight: 1 }}>×</button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Add new option */}
                          <div style={{ display: 'grid', gridTemplateColumns: `1fr ${(f._newOptionPriceType || 'fixed') === 'copy_base' ? 'auto' : '80px'} 72px auto`, gap: 6 }}>
                            <input
                              value={f._newOption || ''}
                              onChange={e => updateField(idx, '_newOption', e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(idx); } }}
                              placeholder="Option label (e.g. Express)"
                              style={{ ...S.input, fontSize: 12 }}
                            />
                            {(f._newOptionPriceType || 'fixed') === 'copy_base' ? (
                              <span style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', fontSize: 11, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', borderRadius: 6, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                = base price
                              </span>
                            ) : (
                              <input
                                type="number" min="0" step="1"
                                value={f._newOptionPrice || ''}
                                onChange={e => updateField(idx, '_newOptionPrice', e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(idx); } }}
                                placeholder="₱ price"
                                style={{ ...S.input, fontSize: 12 }}
                              />
                            )}
                            <input
                              type="number" min="1" max="30" step="1"
                              value={f._newOptionTurnaround || ''}
                              onChange={e => updateField(idx, '_newOptionTurnaround', e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(idx); } }}
                              placeholder="⏱ days"
                              title="Turnaround override in days (optional)"
                              style={{ ...S.input, fontSize: 12 }}
                            />
                            <button onClick={() => addOption(idx)}
                              style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', background: '#38a9c2', color: '#fff', border: 'none', fontWeight: 500, whiteSpace: 'nowrap' }}>
                              + Add
                            </button>
                          </div>

                          {/* Price type toggle */}
                          <div style={{ marginTop: 6, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button type="button"
                              onClick={() => updateField(idx, '_newOptionPriceType', (f._newOptionPriceType || 'fixed') === 'copy_base' ? 'fixed' : 'copy_base')}
                              style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                                color: (f._newOptionPriceType || 'fixed') === 'copy_base' ? '#7C3AED' : '#374151', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                              {(f._newOptionPriceType || 'fixed') === 'copy_base'
                                ? '↩ Switch to fixed price'
                                : '= Switch to copy base price (e.g. Express doubles the bag price)'}
                            </button>
                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>⏱ days = optional turnaround override (e.g. 1 for Express)</span>
                          </div>
                        </div>
                      )}

                      {/* Required + move/remove */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        <label style={{ fontSize: 12, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <input type="checkbox" checked={f.required || false} onChange={e => updateField(idx, 'required', e.target.checked)} />
                          Required
                        </label>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => moveField(idx, -1)} disabled={idx === 0} title="Move up"
                            style={{ fontSize: 12, padding: '3px 7px', borderRadius: 4, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ddd', color: idx === 0 ? '#ddd' : '#374151' }}>↑</button>
                          <button onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1} title="Move down"
                            style={{ fontSize: 12, padding: '3px 7px', borderRadius: 4, cursor: 'pointer', background: 'transparent', border: '0.5px solid #ddd', color: idx === fields.length - 1 ? '#ddd' : '#374151' }}>↓</button>
                          <button onClick={() => removeField(idx)} title="Remove"
                            style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', background: '#FCEBEB', border: '0.5px solid #F09595', color: '#A32D2D' }}>✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSvcSave} disabled={saving} style={S.btn('#38a9c2', '#fff')}>{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => { setSvcForm(null); setPreview(null); setFields([]); }} style={S.btn('#f0f0ec', '#444')}>Cancel</button>
              {!svcForm.isNew && <button onClick={() => handleSvcDelete(svcForm.id)}
                style={{ padding: '8px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#FCEBEB', border: '0.5px solid #F09595', color: '#A32D2D' }}>Delete</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── Category Modal ─────────────────────────────────────────────── */}
      {catForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: 360, border: '0.5px solid #e8e8e0' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>{catForm.isNew ? 'Add category' : 'Edit category'}</div>

            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Category name</label>
              <input value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Basic Services" style={S.input} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Sort order (lower = first)</label>
              <input type="number" value={catForm.sort_order} onChange={e => setCatForm(p => ({ ...p, sort_order: +e.target.value }))} style={S.input} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input type="checkbox" id="catActive" checked={catForm.active} onChange={e => setCatForm(p => ({ ...p, active: e.target.checked }))} />
              <label htmlFor="catActive" style={{ fontSize: 13, cursor: 'pointer' }}>Active (visible to customers)</label>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCatSave} disabled={saving} style={S.btn('#38a9c2', '#fff')}>{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setCatForm(null)} style={S.btn('#f0f0ec', '#444')}>Cancel</button>
              {!catForm.isNew && <button onClick={() => handleCatDelete(catForm.id)}
                style={{ padding: '8px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#FCEBEB', border: '0.5px solid #F09595', color: '#A32D2D' }}>Delete</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
