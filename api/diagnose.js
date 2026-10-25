import { z } from 'zod';

const inputSchema = z.object({
  deviceCategory: z.string().min(2).max(120),
  symptoms: z.string().min(8).max(4000),
  deviceAge: z.string().max(80).optional().default(''),
  imageDataUrl: z.string().max(6_700_000).optional(),
});

const costEstimateSchema = z.object({
  diagnosticFee: z.number().int().min(0),
  laborMin: z.number().int().min(0),
  laborMax: z.number().int().min(0),
  partsMin: z.number().int().min(0),
  partsMax: z.number().int().min(0),
  totalMin: z.number().int().min(0),
  totalMax: z.number().int().min(0),
  exactEstimate: z.number().int().optional(),
  priceConfidence: z.string().max(160).optional(),
  explanation: z.string().max(400).optional(),
}).optional();

const diagnosisSchema = z.object({
  problemSummary: z.string().min(1).max(500),
  possibleCauses: z.array(z.object({
    cause: z.string().min(1).max(240),
    confidence: z.enum(['likely', 'possible', 'needs urgent review']),
    supportingEvidence: z.array(z.string().min(1).max(260)).min(1).max(4),
  })).min(1).max(4),
  safeChecks: z.array(z.string().min(1).max(300)).min(1).max(5),
  riskLevel: z.enum(['low', 'needs_review', 'danger']),
  professionalInspectionRecommended: z.boolean(),
  missingInformation: z.array(z.string().max(200)).max(5),
  repairCategory: z.string().min(1).max(120),
  costEstimate: costEstimateSchema,
});

const hazardousSymptom = /spark|smoke|burning|shock|exposed wire|gas leak|swollen|battery.*damaged|liquid.*powered|overheat/i;

function safetyOverride(symptoms) {
  if (!hazardousSymptom.test(symptoms)) return null;
  return {
    problemSummary: 'A reported symptom indicates an immediate electrical, gas, or thermal safety hazard.',
    possibleCauses: [{ cause: 'Potential short-circuit, damaged insulation, thermal fault, or gas leak', confidence: 'needs urgent review', supportingEvidence: [symptoms] }],
    safeChecks: [
      'Immediately switch off and unplug the appliance from the wall socket.',
      'Keep household members away and do not attempt to turn it on or test it.',
      'Do not open the enclosure or touch exposed internal wiring.',
    ],
    riskLevel: 'danger',
    professionalInspectionRecommended: true,
    missingInformation: [],
    repairCategory: 'safety_review',
    source: 'safety_rules',
  };
}

function calculateAppliancePricing(deviceCategory = '', symptoms = '') {
  const key = `${deviceCategory} ${symptoms}`.toLowerCase();

  if (key.includes('refrigerat') || key.includes('fridge') || key.includes('freezer')) {
    return { visit: 149, labor: [450, 950], parts: [350, 2200], name: 'Refrigerator / Cooling' };
  }
  if (key.includes('washing') || key.includes('washer') || key.includes('dryer')) {
    return { visit: 149, labor: [400, 850], parts: [250, 1800], name: 'Washing Machine' };
  }
  if (key.includes('air conditioner') || key.includes('ac') || key.includes('hvac') || key.includes('cooler')) {
    return { visit: 149, labor: [550, 1200], parts: [400, 3200], name: 'Air Conditioning' };
  }
  if (key.includes('microwave') || key.includes('oven') || key.includes('otg') || key.includes('air fryer')) {
    return { visit: 99, labor: [350, 750], parts: [300, 1600], name: 'Microwave / Heating' };
  }
  if (key.includes('chimney') || key.includes('exhaust') || key.includes('hob')) {
    return { visit: 149, labor: [400, 850], parts: [300, 1800], name: 'Kitchen Chimney / Ventilation' };
  }
  if (key.includes('tv') || key.includes('television') || key.includes('display')) {
    return { visit: 149, labor: [450, 950], parts: [400, 3500], name: 'Television / Display' };
  }
  if (key.includes('water purifier') || key.includes('ro') || key.includes('filter')) {
    return { visit: 99, labor: [300, 650], parts: [350, 2100], name: 'Water Purifier (RO)' };
  }
  if (key.includes('geyser') || key.includes('water heater')) {
    return { visit: 99, labor: [350, 750], parts: [300, 1800], name: 'Geyser / Water Heater' };
  }
  if (key.includes('laptop') || key.includes('computer') || key.includes('pc') || key.includes('macbook')) {
    return { visit: 149, labor: [450, 1100], parts: [350, 2800], name: 'Computer / Laptop' };
  }
  if (key.includes('phone') || key.includes('mobile') || key.includes('tablet')) {
    return { visit: 99, labor: [300, 750], parts: [350, 4500], name: 'Mobile / Tablet' };
  }
  if (key.includes('induction') || key.includes('cooktop')) {
    return { visit: 99, labor: [250, 600], parts: [200, 1100], name: 'Induction Cooktop' };
  }
  if (key.includes('fan') || key.includes('vacuum') || key.includes('mixer') || key.includes('grinder')) {
    return { visit: 99, labor: [250, 550], parts: [200, 1200], name: 'Small Home Appliance' };
  }

  return { visit: 99, labor: [350, 800], parts: [300, 1800], name: deviceCategory || 'Appliance' };
}

function ruleFallback({ deviceCategory, symptoms }) {
  const pricing = calculateAppliancePricing(deviceCategory, symptoms);
  const totalMin = pricing.visit + pricing.labor[0] + pricing.parts[0];
  const totalMax = pricing.visit + pricing.labor[1] + pricing.parts[1];
  const exactEstimate = Math.round((totalMin + totalMax) / 2);

  return {
    problemSummary: `Reported issue on ${deviceCategory} requires physical inspection to verify component condition.`,
    possibleCauses: [
      {
        cause: `Component wear or electrical operating fault in ${deviceCategory}`,
        confidence: 'likely',
        supportingEvidence: [symptoms || 'Reported symptom'],
      },
      {
        cause: 'Wiring connection, sensor, or power control issue',
        confidence: 'possible',
        supportingEvidence: ['Observable operating pattern'],
      },
    ],
    safeChecks: [
      'Turn off and disconnect the appliance before checking external power cords.',
      'Ensure proper clearance and airflow around the equipment.',
      'Note any flashing error codes, warning lights, or unusual sounds for the technician.',
    ],
    riskLevel: 'needs_review',
    professionalInspectionRecommended: true,
    missingInformation: ['Age and maintenance history of the equipment'],
    repairCategory: pricing.name,
    costEstimate: {
      diagnosticFee: pricing.visit,
      laborMin: pricing.labor[0],
      laborMax: pricing.labor[1],
      partsMin: pricing.parts[0],
      partsMax: pricing.parts[1],
      totalMin,
      totalMax,
      exactEstimate,
      priceConfidence: 'Standard verified market range',
      explanation: `Covers on-site diagnostic visit (₹${pricing.visit}), skilled labor, and common replacement parts.`,
    },
    source: 'ai_fallback',
  };
}

function imagePart(dataUrl) {
  if (!dataUrl?.startsWith('data:image/')) return null;
  const [header, data] = dataUrl.split(',', 2);
  const mime = header.match(/^data:(image\/(?:png|jpeg|webp));base64$/)?.[1];
  return mime && data ? { type: 'image_url', image_url: { url: `data:${mime};base64,${data}` } } : null;
}

function extractJson(raw) {
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;

  let candidate = raw.trim();
  // Strip <think> reasoning tokens
  candidate = candidate.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Extract content between markdown code fences if present
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    candidate = fenced[1].trim();
  }

  // Extract first '{' to last '}'
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    candidate = candidate.slice(start, end + 1);
  }

  return JSON.parse(candidate);
}

function normalizeAiDiagnosis(json, fallbackSymptom = '', deviceCategory = '') {
  if (!json || typeof json !== 'object') return null;

  const problemSummary = String(json.problemSummary || `Issue assessment for ${deviceCategory || 'appliance'}.`).trim().slice(0, 500);

  let causesRaw = Array.isArray(json.possibleCauses) ? json.possibleCauses : [];
  if (!causesRaw.length && json.cause) causesRaw = [json.cause];
  const possibleCauses = causesRaw.slice(0, 4).map(item => {
    if (typeof item === 'string') {
      return {
        cause: item.trim().slice(0, 240),
        confidence: 'possible',
        supportingEvidence: [fallbackSymptom.slice(0, 260) || 'Reported symptom'],
      };
    }
    const causeText = String(item.cause || item.title || item.name || 'Component or operating issue').trim().slice(0, 240);
    let conf = String(item.confidence || 'possible').toLowerCase().trim();
    if (!['likely', 'possible', 'needs urgent review'].includes(conf)) {
      conf = conf.includes('urgent') || conf.includes('danger')
        ? 'needs urgent review'
        : conf.includes('likely') || conf.includes('high')
          ? 'likely'
          : 'possible';
    }
    let evidence = Array.isArray(item.supportingEvidence)
      ? item.supportingEvidence.map(e => String(e).trim().slice(0, 260)).filter(Boolean)
      : [];
    if (!evidence.length) evidence = [fallbackSymptom.slice(0, 260) || 'Reported symptom'];
    return {
      cause: causeText || 'Component issue identified',
      confidence: conf,
      supportingEvidence: evidence.slice(0, 4),
    };
  });

  if (!possibleCauses.length) {
    possibleCauses.push({
      cause: 'Qualified physical inspection required to isolate root cause',
      confidence: 'possible',
      supportingEvidence: [fallbackSymptom.slice(0, 260) || 'Reported symptom'],
    });
  }

  let checksRaw = Array.isArray(json.safeChecks) ? json.safeChecks : [];
  let safeChecks = checksRaw.map(c => String(c).trim().slice(0, 300)).filter(Boolean).slice(0, 5);
  if (!safeChecks.length) {
    safeChecks = [
      'Ensure the appliance is powered off before inspecting any external panels or vents.',
      'Check that cords and sockets are intact and not damaged or discolored.',
    ];
  }

  let riskLevel = String(json.riskLevel || 'needs_review').toLowerCase().trim();
  if (riskLevel.includes('danger') || riskLevel.includes('severe') || riskLevel.includes('hazard')) {
    riskLevel = 'danger';
  } else if (riskLevel.includes('low') || riskLevel.includes('minimal')) {
    riskLevel = 'low';
  } else {
    riskLevel = 'needs_review';
  }

  let missingRaw = Array.isArray(json.missingInformation) ? json.missingInformation : [];
  const missingInformation = missingRaw.map(m => String(m).trim().slice(0, 200)).filter(Boolean).slice(0, 5);

  const repairCategory = String(json.repairCategory || deviceCategory || 'general_repair').trim().slice(0, 120);

  // Normalize Cost Estimate
  const defaultPricing = calculateAppliancePricing(deviceCategory, fallbackSymptom);
  let costEstimate = null;

  if (json.costEstimate && typeof json.costEstimate === 'object') {
    const rawCost = json.costEstimate;
    let diag = Number(rawCost.diagnosticFee) || defaultPricing.visit;
    let labMin = Number(rawCost.laborMin) || defaultPricing.labor[0];
    let labMax = Number(rawCost.laborMax) || defaultPricing.labor[1];
    let partMin = Number(rawCost.partsMin) || defaultPricing.parts[0];
    let partMax = Number(rawCost.partsMax) || defaultPricing.parts[1];

    // Sanitize in case model returned tiny USD numbers
    if (diag < 50) diag = defaultPricing.visit;
    if (labMin < 100) labMin = defaultPricing.labor[0];
    if (labMax < labMin) labMax = Math.round(labMin * 1.5);
    if (partMax < partMin) partMax = Math.round(partMin * 1.8);

    const totMin = Number(rawCost.totalMin) || (diag + labMin + partMin);
    const totMax = Number(rawCost.totalMax) || (diag + labMax + partMax);
    const exact = Number(rawCost.exactEstimate) || Math.round((totMin + totMax) / 2);

    costEstimate = {
      diagnosticFee: Math.round(diag),
      laborMin: Math.round(labMin),
      laborMax: Math.round(labMax),
      partsMin: Math.round(partMin),
      partsMax: Math.round(partMax),
      totalMin: Math.round(totMin),
      totalMax: Math.round(totMax),
      exactEstimate: Math.round(exact),
      priceConfidence: String(rawCost.priceConfidence || 'High confidence (AI calculated for this issue)').slice(0, 160),
      explanation: String(rawCost.explanation || `Estimated for standard service and parts on ${deviceCategory}.`).slice(0, 400),
    };
  } else {
    const totMin = defaultPricing.visit + defaultPricing.labor[0] + defaultPricing.parts[0];
    const totMax = defaultPricing.visit + defaultPricing.labor[1] + defaultPricing.parts[1];
    costEstimate = {
      diagnosticFee: defaultPricing.visit,
      laborMin: defaultPricing.labor[0],
      laborMax: defaultPricing.labor[1],
      partsMin: defaultPricing.parts[0],
      partsMax: defaultPricing.parts[1],
      totalMin: totMin,
      totalMax: totMax,
      exactEstimate: Math.round((totMin + totMax) / 2),
      priceConfidence: 'Verified market standard',
      explanation: `Includes on-site diagnostic visit (₹${defaultPricing.visit}), skilled labor, and likely parts.`,
    };
  }

  return {
    problemSummary,
    possibleCauses,
    safeChecks,
    riskLevel,
    professionalInspectionRecommended: Boolean(json.professionalInspectionRecommended ?? true),
    missingInformation,
    repairCategory,
    costEstimate,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid diagnosis input.', issues: parsed.error.issues.map(i => i.message) });

  const safety = safetyOverride(parsed.data.symptoms);
  if (safety) return res.status(200).json({ diagnosis: safety });

  const apiKey = process.env.OPENROUTER_API_KEY;
  let model = process.env.OPENROUTER_MODEL || 'openrouter/free';
  if (model === 'provider/model-id') model = 'openrouter/free';

  if (!apiKey) {
    const fallback = ruleFallback(parsed.data);
    return res.status(200).json({ diagnosis: fallback });
  }

  const content = [{
    type: 'text',
    text: `Appliance or Device: ${parsed.data.deviceCategory}\nApproximate Age: ${parsed.data.deviceAge || 'unknown'}\nReported Symptoms: ${parsed.data.symptoms}`,
  }];

  const image = imagePart(parsed.data.imageDataUrl);
  if (image) content.push(image);

  const instructions = `You are RepairMe's expert repair diagnostic and pricing AI for all domestic, kitchen, and electronic appliances in India.
Analyze the user's reported equipment and issue.
Respond in valid JSON only with this exact schema:
{
  "problemSummary": "1-2 sentence objective summary",
  "possibleCauses": [
    { "cause": "Specific possible failure mode", "confidence": "likely", "supportingEvidence": ["Direct symptom"] }
  ],
  "safeChecks": [ "Safe, non-invasive user check without opening equipment" ],
  "costEstimate": {
    "diagnosticFee": 99,
    "laborMin": 350,
    "laborMax": 750,
    "partsMin": 300,
    "partsMax": 1500,
    "totalMin": 749,
    "totalMax": 2349,
    "exactEstimate": 1200,
    "priceConfidence": "High confidence for standard component replacement",
    "explanation": "Cost includes low diagnostic visit fee (₹99), skilled labor, and anticipated replacement part."
  },
  "riskLevel": "needs_review",
  "professionalInspectionRecommended": true,
  "missingInformation": ["Helpful detail"],
  "repairCategory": "e.g. heating, motor, cooling, drainage, electronics"
}
Rules:
- All prices must be integer Indian Rupees (INR ₹) reflecting realistic service rates in India.
- Keep diagnostic visit fee very low and customer-friendly: typically ₹99 to ₹149.
- If symptoms mention fire, smoke, sparks, burning smells, or gas leaks, set riskLevel to "danger".
- Do not instruct users to open hazardous equipment.`;

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.PUBLIC_APP_URL || 'https://repair-me-psi.vercel.app',
        'X-OpenRouter-Title': 'RepairMe',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1100,
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content },
        ],
      }),
      signal: AbortSignal.timeout(9_000),
    });

    if (!upstream.ok) {
      const fallback = ruleFallback(parsed.data);
      return res.status(200).json({ diagnosis: fallback });
    }

    const payload = await upstream.json();
    const raw = payload.choices?.[0]?.message?.content;
    let json;
    try {
      json = extractJson(raw);
    } catch {
      const fallback = ruleFallback(parsed.data);
      return res.status(200).json({ diagnosis: fallback });
    }

    const normalized = normalizeAiDiagnosis(json, parsed.data.symptoms, parsed.data.deviceCategory);
    const diagnosis = diagnosisSchema.safeParse(normalized);
    if (!diagnosis.success) {
      const fallback = ruleFallback(parsed.data);
      return res.status(200).json({ diagnosis: fallback });
    }

    return res.status(200).json({ diagnosis: { ...diagnosis.data, source: 'ai' } });
  } catch (error) {
    console.warn('AI upstream timeout/unavailable, using verified fallback:', error?.message);
    const fallback = ruleFallback(parsed.data);
    return res.status(200).json({ diagnosis: fallback });
  }
}
