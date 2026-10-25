export const REQUEST_STATUS = {
  REQUESTED: 'REQUESTED',
  ACCEPTED: 'ACCEPTED',
  INSPECTION: 'INSPECTION',
  QUOTE_PENDING: 'QUOTE_PENDING',
  APPROVED: 'APPROVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const STATUS_LABELS = {
  REQUESTED: 'Waiting for a Repair Partner', ACCEPTED: 'Accepted', INSPECTION: 'Inspection in progress',
  QUOTE_PENDING: 'Quote ready for approval', APPROVED: 'Approved — ready to schedule',
  IN_PROGRESS: 'Repair in progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};

export const transitionRules = {
  customer: {
    REQUESTED: ['CANCELLED'], QUOTE_PENDING: ['APPROVED', 'CANCELLED'], ACCEPTED: ['CANCELLED'],
    INSPECTION: ['CANCELLED'], APPROVED: [], IN_PROGRESS: [], COMPLETED: [], CANCELLED: [],
  },
  repair_partner: {
    REQUESTED: ['ACCEPTED', 'CANCELLED'], ACCEPTED: ['INSPECTION', 'CANCELLED'],
    INSPECTION: ['QUOTE_PENDING', 'CANCELLED'], QUOTE_PENDING: [], APPROVED: ['IN_PROGRESS'],
    IN_PROGRESS: ['COMPLETED'], COMPLETED: [], CANCELLED: [],
  },
};

export const pricingRules = {
  Refrigerator: { visit: 350, labor: [550, 1200], parts: [300, 2250], replacement: 28000 },
  'Washing machine': { visit: 300, labor: [450, 1100], parts: [100, 1500], replacement: 22000 },
  Laptop: { visit: 400, labor: [500, 1400], parts: [200, 1900], replacement: 65000 },
  'Air conditioner': { visit: 450, labor: [700, 1600], parts: [350, 3200], replacement: 38000 },
  Smartphone: { visit: 250, labor: [350, 900], parts: [300, 5500], replacement: 30000 },
};

export const repairPartners = [
  { id: 'partner-anu', name: 'Anu Nair', business: 'Northline Home Care', locality: 'Indiranagar', distance: '1.8 km', years: 8, visitFee: 350, categories: ['Refrigerator', 'Washing machine', 'Air conditioner'], brands: ['LG', 'Samsung', 'Whirlpool'], slots: ['Tomorrow · 10:00–12:00', 'Tomorrow · 14:00–16:00'], intro: 'Home appliance repair with clear inspections and itemized quotes.' },
  { id: 'partner-dev', name: 'Dev Shah', business: 'Circuit & Coil', locality: 'Koramangala', distance: '3.1 km', years: 6, visitFee: 400, categories: ['Laptop', 'Smartphone', 'Refrigerator'], brands: ['Apple', 'Dell', 'HP', 'Samsung'], slots: ['Tomorrow · 11:00–13:00', 'Friday · 10:00–12:00'], intro: 'Electronics and cooling diagnostics for everyday devices.' },
  { id: 'partner-ima', name: 'Imran Khan', business: 'CareFix Appliances', locality: 'Domlur', distance: '4.0 km', years: 11, visitFee: 300, categories: ['Refrigerator', 'Washing machine', 'Air conditioner'], brands: ['Bosch', 'Haier', 'Godrej', 'Samsung'], slots: ['Today · 17:00–19:00', 'Saturday · 09:00–11:00'], intro: 'Independent appliance repair — self-declared experience.' },
];

const hazardPattern = /spark|smoke|burning|shock|exposed wire|gas leak|swollen|battery.*damaged|liquid.*powered|overheat/i;

export function makeDiagnosis({ deviceCategory, symptoms }) {
  const unsafe = hazardPattern.test(symptoms || '');
  if (unsafe) {
    return { source: 'safety_rules', riskLevel: 'danger', professionalInspectionRecommended: true,
      problemSummary: 'A reported symptom may create an immediate safety risk.',
      possibleCauses: [{ cause: 'Potential electrical, thermal, gas, or battery hazard', confidence: 'needs urgent review', supportingEvidence: [symptoms] }],
      safeChecks: ['If it is safe to do so, switch off and unplug the device.', 'Keep people away from the device and arrange qualified assistance.', 'Do not open the device, touch exposed conductors, or handle a leaking or swollen battery.'],
      missingInformation: [], repairCategory: 'safety_review' };
  }
  const key = String(deviceCategory || '').toLowerCase();
  const causes = key.includes('refrigerator')
    ? [['Restricted airflow or dirty condenser', 'possible'], ['Cooling-system component fault', 'possible']]
    : key.includes('washing') ? [['Blocked drain filter or hose', 'likely'], ['Drain pump fault', 'possible']]
    : key.includes('laptop') ? [['Dust buildup reducing airflow', 'likely'], ['Cooling fan or thermal compound wear', 'possible']]
    : key.includes('air') ? [['Filter or airflow restriction', 'possible'], ['Cooling-system issue', 'possible']]
    : [['Power, battery, or component issue', 'possible'], ['A device-specific inspection is needed', 'possible']];
  return { source: 'guided_preliminary', riskLevel: 'needs_review', professionalInspectionRecommended: true,
    problemSummary: `The reported ${deviceCategory || 'device'} issue needs a qualified inspection to confirm the cause.`,
    possibleCauses: causes.map(([cause, confidence]) => ({ cause, confidence, supportingEvidence: [symptoms || 'No detailed symptom provided'] })),
    safeChecks: ['Turn the device off before cleaning or checking the manual.', 'Do not disassemble electrical or sealed cooling equipment.', 'Note any error code, pattern, or change in sound for the inspection.'],
    missingInformation: symptoms?.length < 18 ? ['When the issue started and whether it is continuous'] : [], repairCategory: 'general_diagnosis' };
}

export function makeEstimate(category) {
  const rule = pricingRules[category] || pricingRules.Refrigerator;
  return { diagnosticFee: rule.visit, laborMin: rule.labor[0], laborMax: rule.labor[1], partsMin: rule.parts[0], partsMax: rule.parts[1],
    totalMin: rule.visit + rule.labor[0] + rule.parts[0], totalMax: rule.visit + rule.labor[1] + rule.parts[1], replacement: rule.replacement,
    assumptions: ['Transparent preliminary regional estimate range.', 'Final itemized quotation requires on-site inspection and your explicit approval before work begins.'] };
}

export const money = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
export const isoNow = () => new Date().toISOString();

export function canTransition(role, current, target) {
  return Boolean(transitionRules[role]?.[current]?.includes(target));
}

export function newRequest(form, user, diagnosis, estimate, partner, slot) {
  const id = `req-${Date.now()}`;
  return { id, customerId: user.id, customerName: user.name, deviceCategory: form.deviceCategory, brandModel: form.brandModel || 'Not provided', deviceAge: form.deviceAge || 'Not provided', symptoms: form.symptoms,
    locality: form.locality || 'Not provided', photoName: form.photoName || null, diagnosis, estimate, partnerId: partner?.id || null, partnerName: partner?.name || null,
    appointment: slot || null, status: 'REQUESTED', quote: null, inspectionNotes: null, createdAt: isoNow(), updatedAt: isoNow(),
    events: [{ at: isoNow(), actor: 'customer', status: 'REQUESTED', note: 'Repair request created' }] };
}

export function createDemoRequest() {
  const diagnosis = makeDiagnosis({ deviceCategory: 'Refrigerator', symptoms: 'The refrigerator is running but food is warmer than usual. It has been happening since yesterday.' });
  const estimate = makeEstimate('Refrigerator');
  return newRequest({ deviceCategory: 'Refrigerator', brandModel: 'Samsung RT28', deviceAge: '4 years', locality: 'Indiranagar', symptoms: 'The refrigerator is running but food is warmer than usual. It has been happening since yesterday.' }, { id: 'demo-customer', name: 'Maya Rao' }, diagnosis, estimate);
}
