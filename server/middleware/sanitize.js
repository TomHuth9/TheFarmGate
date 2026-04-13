'use strict';

// Keys that can enable prototype pollution — drop them silently
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Strips null bytes and ASCII control characters that have no place in text input.
// Keeps tab (0x09), line feed (0x0A), carriage return (0x0D) — valid in multiline fields.
// Removes everything else in 0x00–0x1F, plus DEL (0x7F).
const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function sanitizeValue(value) {
  if (typeof value === 'string') {
    return value.trim().replace(CONTROL_RE, '');
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      result[key] = sanitizeValue(value[key]);
    }
    return result;
  }
  return value; // numbers, booleans, null — pass through unchanged
}

function sanitizeInputs(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeValue(req.body);
  if (req.query && typeof req.query === 'object') req.query = sanitizeValue(req.query);
  next();
}

module.exports = { sanitizeInputs };
