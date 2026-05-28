'use strict';

/**
 * CV parser — extracts raw text from uploaded PDF/DOCX files.
 * Uses pdf-parse for PDFs. DOCX support via mammoth (optional).
 * Falls back to plain text if neither parser is available.
 */

const path = require('path');
const { logger } = require('../../shared/logger');

async function extractText(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();

  if (mimeType === 'application/pdf' || ext === '.pdf') {
    return _parsePdf(filePath);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    return _parseDocx(filePath);
  }

  if (mimeType === 'text/plain' || ext === '.txt') {
    const fs = require('fs').promises;
    return fs.readFile(filePath, 'utf-8');
  }

  throw new Error(`Unsupported file type: ${mimeType || ext}`);
}

async function _parsePdf(filePath) {
  let pdfParse;
  try {
    pdfParse = require('pdf-parse');
  } catch {
    throw new Error('pdf-parse not installed — run: npm install pdf-parse');
  }
  const fs = require('fs').promises;
  const buffer = await fs.readFile(filePath);
  const result = await pdfParse(buffer);
  logger.debug(`[cv-parser] PDF extracted ${result.numpages} pages, ${result.text.length} chars`);
  return result.text;
}

async function _parseDocx(filePath) {
  let mammoth;
  try {
    mammoth = require('mammoth');
  } catch {
    throw new Error('mammoth not installed — run: npm install mammoth');
  }
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

module.exports = { extractText };
