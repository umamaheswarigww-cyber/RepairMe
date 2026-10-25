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
  REQUESTED: 'Waiting for a Repair Partner',
  ACCEPTED: 'Accepted',
  INSPECTION: 'Inspection in progress',
  QUOTE_PENDING: 'Quote ready for approval',
  APPROVED: 'Approved — ready to schedule',
  IN_PROGRESS: 'Repair in progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const transitionRules = {
  customer: {
    REQUESTED: ['CANCELLED'],
    QUOTE_PENDING: ['APPROVED', 'CANCELLED'],
    ACCEPTED: ['CANCELLED'],
    INSPECTION: ['CANCELLED'],
    APPROVED: [],
    IN_PROGRESS: [],
    COMPLETED: [],
    CANCELLED: [],
  },
  repair_partner: {
    REQUESTED: ['ACCEPTED', 'CANCELLED'],
    ACCEPTED: ['INSPECTION', 'CANCELLED'],
    INSPECTION: ['QUOTE_PENDING', 'CANCELLED'],
    QUOTE_PENDING: [],
    APPROVED: ['IN_PROGRESS'],
    IN_PROGRESS: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
  },
};

export function getPricingForAppliance(category = '', symptoms = '') {
  const key = `${category} ${symptoms}`.toLowerCase();

  if (key.includes('refrigerat') || key.includes('fridge') || key.includes('freezer')) {
    return { visit: 149, labor: [450, 950], parts: [350, 2200], name: 'Refrigerator / Freezer' };
  }
  if (key.includes('washing') || key.includes('washer') || key.includes('dryer') || key.includes('laundry')) {
    return { visit: 149, labor: [400, 850], parts: [250, 1800], name: 'Washing Machine' };
  }
  if (key.includes('air conditioner') || key.includes('ac') || key.includes('hvac') || key.includes('split ac') || key.includes('cooler')) {
    return { visit: 149, labor: [550, 1200], parts: [400, 3200], name: 'Air Conditioner' };
  }
  if (key.includes('microwave') || key.includes('oven') || key.includes('otg') || key.includes('air fryer') || key.includes('toaster')) {
    return { visit: 99, labor: [350, 750], parts: [300, 1600], name: 'Microwave / Oven' };
  }
  if (key.includes('chimney') || key.includes('exhaust') || key.includes('hob') || key.includes('stove')) {
    return { visit: 149, labor: [400, 850], parts: [300, 1800], name: 'Kitchen Chimney / Hob' };
  }
  if (key.includes('tv') || key.includes('television') || key.includes('monitor') || key.includes('display') || key.includes('screen')) {
    return { visit: 149, labor: [450, 950], parts: [400, 3500], name: 'Television / Display' };
  }
  if (key.includes('water purifier') || key.includes('ro') || key.includes('uv filter') || key.includes('filter')) {
    return { visit: 99, labor: [300, 650], parts: [350, 2100], name: 'Water Purifier (RO)' };
  }
  if (key.includes('geyser') || key.includes('water heater') || key.includes('immersion')) {
    return { visit: 99, labor: [350, 750], parts: [300, 1800], name: 'Geyser / Water Heater' };
  }
  if (key.includes('laptop') || key.includes('computer') || key.includes('pc') || key.includes('macbook') || key.includes('desktop')) {
    return { visit: 149, labor: [450, 1100], parts: [350, 2800], name: 'Laptop / Computer' };
  }
  if (key.includes('phone') || key.includes('smartphone') || key.includes('mobile') || key.includes('tablet') || key.includes('ipad')) {
    return { visit: 99, labor: [300, 750], parts: [350, 4500], name: 'Mobile / Tablet' };
  }
  if (key.includes('induction') || key.includes('cooktop')) {
    return { visit: 99, labor: [250, 600], parts: [200, 1100], name: 'Induction Cooktop' };
  }
  if (key.includes('fan') || key.includes('vacuum') || key.includes('iron') || key.includes('mixer') || key.includes('grinder') || key.includes('blender')) {
    return { visit: 99, labor: [250, 550], parts: [200, 1200], name: 'Small Home Appliance' };
  }
  if (key.includes('sound') || key.includes('speaker') || key.includes('audio') || key.includes('amplifier') || key.includes('theater')) {
    return { visit: 99, labor: [350, 800], parts: [300, 1800], name: 'Audio / Sound Equipment' };
  }

  // General Domestic / Office Appliance Default
  return { visit: 99, labor: [350, 800], parts: [300, 1800], name: category || 'Appliance' };
}

export const repairPartners = [
  {
    id: 'partner-anu',
    name: 'Anu Nair',
    phone: '+91 98450 21984',
    business: 'Northline Home Care',
    locality: 'Indiranagar',
    distance: '1.8 km',
    years: 8,
    visitFee: 149,
    categories: ['All home appliances', 'Refrigerator', 'Washing machine', 'Air conditioner', 'Microwave', 'Kitchen Chimney'],
    slots: ['Tomorrow · 10:00–12:00', 'Tomorrow · 14:00–16:00'],
    intro: 'Comprehensive appliance repair with clear inspections, transparent estimates, and itemized quotes.',
  },
  {
    id: 'partner-dev',
    name: 'Dev Shah',
    phone: '+91 98861 44520',
    business: 'Circuit & Coil',
    locality: 'Koramangala',
    distance: '3.1 km',
    years: 6,
    visitFee: 149,
    categories: ['All electronics & appliances', 'Laptop', 'TV', 'Smartphone', 'Microwave', 'Air conditioner'],
    slots: ['Tomorrow · 11:00–13:00', 'Friday · 10:00–12:00'],
    intro: 'Electronics and household appliances specialist with itemized quotes before work begins.',
  },
  {
    id: 'partner-ima',
    name: 'Imran Khan',
    phone: '+91 99002 88314',
    business: 'CareFix Appliances',
    locality: 'Domlur',
    distance: '4.0 km',
    years: 11,
    visitFee: 99,
    categories: ['All domestic appliances', 'Kitchen Chimney', 'Water Purifier', 'Geyser', 'Washing machine'],
    slots: ['Today · 17:00–19:00', 'Saturday · 09:00–11:00'],
    intro: 'Fast, verified servicing across all kitchen and domestic home appliances.',
  },
];

const hazardPattern = /spark|smoke|burning|shock|exposed wire|gas leak|swollen|battery.*damaged|liquid.*powered|overheat/i;

export function makeDiagnosis({ deviceCategory = 'Appliance', symptoms = '' }) {
  const unsafe = hazardPattern.test(symptoms || '');
  if (unsafe) {
    return {
      source: 'safety_rules',
      riskLevel: 'danger',
      professionalInspectionRecommended: true,
      problemSummary: 'A reported symptom may create an immediate electrical or fire safety risk.',
      possibleCauses: [
        {
          cause: 'Potential electrical short, thermal hazard, or wiring damage',
          confidence: 'needs urgent review',
          supportingEvidence: [symptoms],
        },
      ],
      safeChecks: [
        'If it is safe to do so, immediately switch off and unplug the appliance.',
        'Keep people away from the equipment and arrange qualified assistance.',
        'Do not open the cabinet or touch exposed wiring.',
      ],
      missingInformation: [],
      repairCategory: 'safety_review',
    };
  }

  const pricing = getPricingForAppliance(deviceCategory, symptoms);
  return {
    source: 'guided_preliminary',
    riskLevel: 'needs_review',
    professionalInspectionRecommended: true,
    problemSummary: `Reported ${deviceCategory} issue requires physical inspection to verify component condition.`,
    possibleCauses: [
      {
        cause: `Component wear or electrical fault in ${deviceCategory}`,
        confidence: 'likely',
        supportingEvidence: [symptoms || 'Reported symptom'],
      },
      {
        cause: 'Operating connection, switch, or power regulation issue',
        confidence: 'possible',
        supportingEvidence: ['Observable operating pattern'],
      },
    ],
    safeChecks: [
      'Turn off the appliance before checking external power cords or accessible filters.',
      'Ensure clear airflow around the unit and verify power socket voltage.',
      'Note any error codes, warning lights, or unusual sounds for the technician.',
    ],
    missingInformation: symptoms?.length < 18 ? ['When the issue started and whether it happens consistently'] : [],
    repairCategory: pricing.name,
  };
}

export function makeEstimate(category = '', symptoms = '', aiCost = null) {
  if (aiCost && aiCost.totalMin && aiCost.totalMax) {
    const diagnosticFee = Number(aiCost.diagnosticFee) || 350;
    const laborMin = Number(aiCost.laborMin) || 450;
    const laborMax = Number(aiCost.laborMax) || 950;
    const partsMin = Number(aiCost.partsMin) || 300;
    const partsMax = Number(aiCost.partsMax) || 1800;
    const totalMin = Number(aiCost.totalMin) || (diagnosticFee + laborMin + partsMin);
    const totalMax = Number(aiCost.totalMax) || (diagnosticFee + laborMax + partsMax);
    const exactEstimate = Number(aiCost.exactEstimate) || Math.round((totalMin + totalMax) / 2);

    return {
      diagnosticFee,
      laborMin,
      laborMax,
      partsMin,
      partsMax,
      totalMin,
      totalMax,
      exactEstimate,
      priceConfidence: aiCost.priceConfidence || 'High confidence (AI calculated for this specific issue)',
      explanation: aiCost.explanation || `Estimated for standard service and parts replacement on ${category || 'appliance'}.`,
      assumptions: [
        '100% itemized guarantee: Technician cannot charge more without your explicit written approval.',
        'Final written quote confirmed during on-site physical inspection.',
      ],
    };
  }

  const pricing = getPricingForAppliance(category, symptoms);
  const diagnosticFee = pricing.visit;
  const laborMin = pricing.labor[0];
  const laborMax = pricing.labor[1];
  const partsMin = pricing.parts[0];
  const partsMax = pricing.parts[1];
  const totalMin = diagnosticFee + laborMin + partsMin;
  const totalMax = diagnosticFee + laborMax + partsMax;
  const exactEstimate = Math.round((totalMin + totalMax) / 2);

  return {
    diagnosticFee,
    laborMin,
    laborMax,
    partsMin,
    partsMax,
    totalMin,
    totalMax,
    exactEstimate,
    priceConfidence: 'Verified market standard for ' + (category || 'this appliance'),
    explanation: `Typical diagnostic inspection (${money(diagnosticFee)}), skilled labor, and common replacement parts.`,
    assumptions: [
      '100% itemized guarantee: Technician cannot charge more without your explicit written approval.',
      'Final written quote confirmed during on-site physical inspection.',
    ],
  };
}

export const money = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
export const isoNow = () => new Date().toISOString();

export function canTransition(role, current, target) {
  return Boolean(transitionRules[role]?.[current]?.includes(target));
}

export function newRequest(form, user, diagnosis, estimate, partner, slot) {
  const id = `req-${Date.now()}`;
  return {
    id,
    customerId: user.id,
    customerName: user.name,
    customerPhone: user.phone || form.customerPhone || null,
    deviceCategory: form.deviceCategory,
    deviceAge: form.deviceAge || 'Not specified',
    symptoms: form.symptoms,
    locality: form.locality || 'Not specified',
    photoName: form.photoName || null,
    diagnosis,
    estimate,
    partnerId: partner?.id || null,
    partnerName: partner?.name || null,
    partnerPhone: partner?.phone || '+91 98450 21984',
    appointment: slot || null,
    status: 'REQUESTED',
    quote: null,
    inspectionNotes: null,
    createdAt: isoNow(),
    updatedAt: isoNow(),
    events: [{ at: isoNow(), actor: 'customer', status: 'REQUESTED', note: 'Repair request created' }],
  };
}
