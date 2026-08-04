import { MessageFilterService } from './message-filter.service';

describe('MessageFilterService', () => {
  const service = new MessageFilterService();

  it('allows an ordinary message with no contact info', () => {
    const result = service.scanForExternalContact('Sounds good, I can start on Monday morning.');
    expect(result.blocked).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it('blocks an email address', () => {
    const result = service.scanForExternalContact('Send the invoice to kwame.artisan@gmail.com please.');
    expect(result.blocked).toBe(true);
    expect(result.reasons).toContain('email_address');
  });

  it('blocks a phone number', () => {
    const result = service.scanForExternalContact('You can reach me at 024 123 4567 anytime.');
    expect(result.blocked).toBe(true);
    expect(result.reasons).toContain('phone_number');
  });

  it('blocks a mention of an external messaging platform', () => {
    const result = service.scanForExternalContact("Let's continue on WhatsApp instead.");
    expect(result.blocked).toBe(true);
    expect(result.reasons).toContain('external_platform_mention');
  });

  it('blocks common circumvention phrasing', () => {
    const result = service.scanForExternalContact('Just call me instead of typing all this.');
    expect(result.blocked).toBe(true);
    expect(result.reasons).toContain('circumvention_phrase');
  });

  it('does not false-positive on prices, quantities, or short numbers', () => {
    const result = service.scanForExternalContact('The total is GHS 500 for 3 bags of cement, delivered by day 2.');
    expect(result.blocked).toBe(false);
  });

  it('can flag multiple reasons in one message', () => {
    const result = service.scanForExternalContact('Call me on 024 123 4567 or email me at test@example.com.');
    expect(result.reasons).toEqual(
      expect.arrayContaining(['phone_number', 'email_address', 'circumvention_phrase']),
    );
  });
});
