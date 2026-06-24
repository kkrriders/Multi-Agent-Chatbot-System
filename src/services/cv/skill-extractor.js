'use strict';

/**
 * Extracts structured data from raw CV text using AI.
 * Returns: { name, skills, experience, education }
 */

const ai = require('../ai/provider-manager');
const { assertSafe } = require('../../middleware/injection-guard');

const EXTRACT_PROMPT = (cvText) => `
You are a CV parser. Extract structured information from the CV text below.

CV TEXT:
${cvText.slice(0, 8000)}

Respond with valid JSON matching this schema exactly:
{
  "name": "candidate full name or null",
  "skills": ["skill1", "skill2"],
  "experience": [
    { "company": "...", "role": "...", "duration": "...", "description": "..." }
  ],
  "education": [
    { "institution": "...", "degree": "...", "field": "...", "year": "..." }
  ]
}

Rules:
- skills: extract all technical and soft skills mentioned
- experience: most recent first
- education: most recent first
- If a field is not found, use null or []
`.trim();

async function extract(cvText) {
  assertSafe(cvText, 'cv-text');

  const { data } = await ai.generateJson(EXTRACT_PROMPT(cvText), 'balanced', { maxTokens: 2000 });

  return {
    name: typeof data.name === 'string' ? data.name.slice(0, 200) : null,
    skills: Array.isArray(data.skills)
      ? data.skills.map(s => String(s).slice(0, 100)).slice(0, 100)
      : [],
    experience: Array.isArray(data.experience)
      ? data.experience.slice(0, 20).map(e => ({
          company:     String(e.company || '').slice(0, 200),
          role:        String(e.role || '').slice(0, 200),
          duration:    String(e.duration || '').slice(0, 100),
          description: String(e.description || '').slice(0, 1000),
        }))
      : [],
    education: Array.isArray(data.education)
      ? data.education.slice(0, 10).map(e => ({
          institution: String(e.institution || '').slice(0, 200),
          degree:      String(e.degree || '').slice(0, 200),
          field:       String(e.field || '').slice(0, 200),
          year:        String(e.year || '').slice(0, 10),
        }))
      : [],
  };
}

module.exports = { extract };
