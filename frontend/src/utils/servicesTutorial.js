// Content for the "How to set up services" drawer (components/ServicesTutorial.jsx).
// Every label below is the exact text shown in pages/Services.jsx, and every example price was checked
// against calcItemPrice() in backend/routes/public.js. If you change pricing rules, re-check the examples.

export const TUTORIAL_STEPS = [
  {
    title: 'Create a category',
    body: 'Categories group your services on the booking page, like "Wash & Fold", "Dry Cleaning" or "Bedding".',
    todo: [
      'Click + Category.',
      'Type a name and save.',
      'Drag categories to change the order customers see them.',
    ],
    note: 'If you delete a category later, its services are kept and become uncategorized.',
  },
  {
    title: 'Add your first service',
    body: 'A service is one thing customers can order.',
    todo: [
      'Click + Service and pick its Category.',
      'Fill in Service name, Price (₱) and Unit (for example "per kg" or "per piece").',
      'Add a Description if you want (optional).',
      'Set Turnaround time (days). This is how long until delivery after pickup, and the delivery date is worked out for you.',
    ],
    note: 'Price is required. If you will price by size or type (step 3), enter 0.',
  },
  {
    title: 'How the price is worked out',
    body: 'The total depends on the Unit and the Custom Fields you add. These are the rules:',
    todo: [
      'Per kg: if the Unit contains "kg" and you add a field whose label contains "Weight", the price is Price × the weight entered.',
      'Per piece: add a Number (qty multiplier) field, and the price is Price × the quantity entered.',
      'By size or type: add a Variation field and give each option its own price. The chosen option\'s price becomes the price, and the service Price is not used.',
      'Add-ons: an Add-on field adds its price × the quantity on top.',
    ],
    note: 'Variation prices replace the service Price, which is why you enter 0 for the Price in that case.',
  },
  {
    title: 'Add options with Custom Fields',
    body: 'Click + Add field inside a service. Pick a Type:',
    todo: [
      'Short text or Notes / Long text: information from the customer, like "Color" or "Special instructions".',
      'Number (qty multiplier): pieces or weight. You can set a Min value and Max value.',
      'Variation (select one): a list of options, each with a price (₱). You can also set a ⏱ turnaround override for one option, or use "= base price".',
      'Add-on (with price): an extra the customer picks a quantity of. Set the price per unit.',
    ],
    note: 'Extras on Add-ons: "Show only when…" ties it to a variation option, "Allow \'I\'ll provide my own\'" lets customers skip it, and "Auto-fill quantity from piece count" copies the pieces they entered.',
  },
  {
    title: 'Choose who can see it, then test',
    body: 'Two switches control visibility:',
    todo: [
      'Active (visible to customers): turn off to hide the service without deleting it.',
      'Available for online booking: turn off for "Walk-in POS only" services that only your counter staff should see.',
      'Sort order: lower numbers show first.',
      'Add an image if you like. It is compressed automatically.',
    ],
    note: 'Test it: open your booking link and try the service, or use Walk-in, and check the total matches what you expect.',
  },
];

export const TUTORIAL_EXAMPLES = [
  {
    title: 'Wash & Fold, priced per kg',
    fields: [
      'Service name: Wash & Fold',
      'Price (₱): 45',
      'Unit: per kg',
      'Custom Field: label "Weight (kg)", Type "Number (qty multiplier)", Min value 3',
    ],
    result: 'A customer enters 3.5 kg → 45 × 3.5 = ₱157.50',
  },
  {
    title: 'Comforter, priced by size',
    fields: [
      'Service name: Comforter',
      'Price (₱): 0 (the size sets the price)',
      'Unit: per piece',
      'Custom Field 1: label "Size", Type "Variation (select one)", options Single ₱150, Double ₱200, King ₱280 (set ⏱ 3 days on King if it takes longer)',
      'Custom Field 2: label "Quantity", Type "Number (qty multiplier)"',
    ],
    result: 'A customer picks Double and quantity 2 → ₱200 × 2 = ₱400',
  },
  {
    title: 'Dry cleaning, priced per piece',
    fields: [
      'Service name: Dry Cleaning',
      'Price (₱): 120',
      'Unit: per piece',
      'Custom Field: label "Number of pieces", Type "Number (qty multiplier)", Min value 1',
    ],
    result: 'A customer enters 4 pieces → 120 × 4 = ₱480',
  },
  {
    title: 'Add-on: extra fabric softener',
    fields: [
      'Open the Wash & Fold service and click + Add field',
      'Label: Extra fabric softener, Type "Add-on (with price)"',
      'Add-on price (₱) per unit: 10',
      'Optional: tick "Allow \'I\'ll provide my own\'"',
    ],
    result: 'A customer picks 2 → adds 2 × ₱10 = ₱20 to the total',
  },
];

export const TUTORIAL_MISTAKES = [
  'Per-kg pricing needs "kg" in the Unit AND "weight" in a field label. If either is missing, the price is not multiplied by weight.',
  'An Add-on with a price of 0 adds nothing. Give it a price above 0.',
  'When a Variation has prices, the service Price is ignored, so keep it at 0 to avoid confusion.',
  'A service that is not Active, or is set to Walk-in POS only, will not appear on the online booking page.',
];
