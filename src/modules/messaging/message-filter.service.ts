import { Injectable } from '@nestjs/common';

/**
 * Matches an email address anywhere in the text.
 */
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/**
 * Matches a phone-number-shaped run of digits: 7+ digits, optionally
 * grouped with spaces/dashes/dots/parens, optionally with a leading '+'.
 * Deliberately requires 7+ digits (not just any number) to keep the false
 * -positive rate on prices/quantities/dates low — "GHS 500" or "3 bags"
 * won't match, but "024 123 4567" or "+233241234567" will.
 */
const PHONE_PATTERN = /(?:\+?\d[\d\-.\s()]{6,}\d)/;

/** Named external platforms/handles people use to move a conversation off-platform. */
const EXTERNAL_PLATFORM_PATTERNS = [
  /\bwhats\s?app\b/i,
  /\bwa\.me\b/i,
  /\btelegram\b/i,
  /\bt\.me\b/i,
  /\bsignal\b/i,
  /\bimo\b/i,
  /\bviber\b/i,
  /\bsnapchat\b/i,
  /\binstagram\b|\big:?\s?@/i,
  /\bfacebook\b|\bfb\.com\b|\bmessenger\b/i,
  /@[a-z0-9_.]{3,}/i, // generic "@handle" mention
];

/** Common phrasing used to steer the other party toward an off-platform channel. */
const CIRCUMVENTION_PHRASES = [
  'call me',
  'text me',
  'message me on',
  'reach me on',
  'reach me at',
  'contact me on',
  'contact me at',
  'add me on',
  'dm me',
  'off the platform',
  'off platform',
  'off-platform',
  'outside the app',
  'outside boafie',
  "let's talk outside",
  'my number is',
  'here is my number',
];

export interface ContactInfoScanResult {
  blocked: boolean;
  reasons: string[];
}

/**
 * Rule-based, same deliberately-simple additive approach as
 * ScamDetectorService in the jobs module — no external API call, just
 * pattern matching. Blocks (rather than scores) since the point here is a
 * hard stop: BoaFie's escrow/dispute protection only covers activity that
 * happens on-platform, so contact-info sharing is disallowed outright
 * rather than merely flagged.
 */
@Injectable()
export class MessageFilterService {
  scanForExternalContact(content: string): ContactInfoScanResult {
    const reasons: string[] = [];

    if (EMAIL_PATTERN.test(content)) reasons.push('email_address');
    if (PHONE_PATTERN.test(content)) reasons.push('phone_number');
    if (EXTERNAL_PLATFORM_PATTERNS.some((p) => p.test(content))) reasons.push('external_platform_mention');
    if (CIRCUMVENTION_PHRASES.some((phrase) => content.toLowerCase().includes(phrase))) {
      reasons.push('circumvention_phrase');
    }

    return { blocked: reasons.length > 0, reasons };
  }
}
