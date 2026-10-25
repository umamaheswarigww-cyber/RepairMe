import { z } from 'zod';

const inputSchema = z.object({
  deviceCategory: z.enum(['Refrigerator', 'Washing machine', 'Laptop', 'Air conditioner', 'Smartphone']),
  symptoms: z.string().min(12).max(4000),
  brandModel: z.string().max(160).optional().default(''),
  deviceAge: z.string().max(80).optional().default(''),
  imageDataUrl: z.string().max(6_700_000).optional(),
});

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
});

const hazardousSymptom = /spark|smoke|burning|shock|exposed wire|gas leak|swollen|battery.*damaged|liquid.*powered|overheat/i;

function safetyOverride(symptoms) {
  if (!hazardousSymptom.test(symptoms)) return null;
  return {
    problemSummary: 'A reported symptom may create an immediate safety risk.',
    possibleCauses: [{ cause: 'Potential electrical, thermal, gas, or battery hazard', confidence: 'needs urgent review', supportingEvidence: [symptoms] }],
    safeChecks: [
      'If it is safe to do so, switch off and unplug the device.',
      'Keep people away from the device and arrange qualified assistance.',
      'Do not open the device, touch exposed conductors, or handle a leaking or swollen battery.',
    ],
    riskLevel: 'danger',
    professionalInspectionRecommended: true,
    missingInformation: [],
    repairCategory: 'safety_review',
    source: 'safety_rules',
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
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function normalizeAiDiagnosis(json, fallbackSymptom = '') {
  if (!json || typeof json !== 'object') return null;

  const problemSummary = String(json.problemSummary || 'Preliminary assessment based on reported symptoms.').trim().slice(0, 500);

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
      'Ensure the device is powered off before inspecting any external panels or vents.',
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

  const repairCategory = String(json.repairCategory || 'general_repair').trim().slice(0, 120);

  return {
    problemSummary,
    possibleCauses,
    safeChecks,
    riskLevel,
    professionalInspectionRecommended: Boolean(json.professionalInspectionRecommended ?? true),
    missingInformation,
    repairCategory,
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

  if (!apiKey) return res.status(503).json({ error: 'AI diagnosis is not configured. OPENROUTER_API_KEY is missing.', code: 'AI_NOT_CONFIGURED' });

  const content = [{
    type: 'text',
    text: `Device: ${parsed.data.deviceCategory}\nBrand/model: ${parsed.data.brandModel || 'unknown'}\nApproximate age: ${parsed.data.deviceAge || 'unknown'}\nReported symptoms: ${parsed.data.symptoms}`,
  }];

  const image = imagePart(parsed.data.imageDataUrl);
  if (image) content.push(image);

  const instructions = `You are RepairMe's cautious, professional repair-intake AI assistant.
Analyze the user's reported appliance or electronics problem and respond in JSON with this exact schema:
{
  "problemSummary": "1-2 sentence objective summary of the reported symptom",
  "possibleCauses": [
    {
      "cause": "Specific possible failure mode or cause",
      "confidence": "likely",
      "supportingEvidence": ["Direct symptom or condition that supports this"]
    }
  ],
  "safeChecks": [
    "Safe, non-invasive user check without opening or disassembling (e.g. check power cable, external filter, settings)"
  ],
  "riskLevel": "needs_review",
  "professionalInspectionRecommended": true,
  "missingInformation": ["Helpful detail that could clarify this issue further"],
  "repairCategory": "e.g. cooling, drainage, power supply, thermal management, logic board"
}
Important:
- Return 1 to 4 possibleCauses. Confidence must be strictly "likely", "possible", or "needs urgent review".
- Return 1 to 5 safeChecks.
- Return up to 5 missingInformation items.
- riskLevel must be strictly "low", "needs_review", or "danger".
- If symptoms mention smoke, sparks, burning, shock, gas, or swollen batteries, set riskLevel to "danger".
- Do not instruct users to disassemble electrical, gas, battery, or sealed refrigeration systems.`;

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.PUBLIC_APP_URL || 'http://localhost:5173',
        'X-OpenRouter-Title': 'RepairMe',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error('OpenRouter error:', upstream.status, errText);
      return res.status(502).json({ error: 'The AI provider could not complete this assessment.', code: 'AI_UPSTREAM_ERROR' });
    }

    const payload = await upstream.json();
    const raw = payload.choices?.[0]?.message?.content;
    let json;
    try {
      json = extractJson(raw);
    } catch {
      return res.status(502).json({ error: 'The AI response was not valid structured data.', code: 'AI_INVALID_RESPONSE' });
    }

    const normalized = normalizeAiDiagnosis(json, parsed.data.symptoms);
    const diagnosis = diagnosisSchema.safeParse(normalized);
    if (!diagnosis.success) {
      console.error('Validation failure on normalized AI response:', diagnosis.error.issues);
      return res.status(502).json({ error: 'The AI response did not meet the RepairMe safety contract.', code: 'AI_INVALID_RESPONSE' });
    }

    return res.status(200).json({ diagnosis: { ...diagnosis.data, source: 'ai' } });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError';
    console.error('AI diagnosis error:', error);
    return res.status(502).json({
      error: timedOut ? 'The AI assessment timed out.' : 'The AI assessment is temporarily unavailable.',
      code: timedOut ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE',
    });
  }
}
