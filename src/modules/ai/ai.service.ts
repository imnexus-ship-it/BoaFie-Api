import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIError } from 'openai';
import { ArtisansRepository } from '../artisans/artisans.repository';
import { FreelancersRepository } from '../freelancers/freelancers.repository';
import { JobsRepository } from '../jobs/jobs.repository';
import { GenerateBioDto } from './dto/generate-bio.dto';
import { SupportChatMessageDto } from './dto/support-chat.dto';

const MODEL = 'gpt-4o-mini';

/**
 * Grounds the support assistant in what BoaFie actually does, mirroring
 * the plain-language Trust & Safety page content (identity verification,
 * escrow, disputes, review moderation, messaging rules) plus commission
 * tiers — so it answers from real platform mechanics instead of
 * hallucinating policy. Kept in sync by hand; if that page's content
 * changes materially, update this too.
 */
const SUPPORT_SYSTEM_PROMPT = `You are BoaFie Support, a helpful assistant for BoaFie — a Ghanaian marketplace connecting clients with verified artisans and freelancers.

How BoaFie actually works, so you can answer accurately:
- Clients post jobs or browse professionals; workers submit proposals ("quotations"). Accepting a proposal creates a contract and moves the agreed amount into escrow immediately — the client never pays the worker directly.
- Work can be tracked in milestones. A milestone's share of escrow only releases to the worker once the client reviews and approves it. A contract with no milestones releases its full escrow when the client marks it complete.
- BoaFie deducts a commission only when money is released: 12% on the free plan, 8% on Verified Pro, 5% on Business. The rate is always shown before funds move.
- Identity verification: ID document, a selfie matched against it, location, and (for artisans) a trade certificate — each reviewed by BoaFie's team. A "Verified" badge appears once enough checks pass a trust threshold; it is not automatic.
- Reviews can only be left by a client who paid for and completed that specific contract — one review per contract, so they can't be faked or bought.
- Disputes: either party can raise one directly on a contract if something's wrong. This immediately pauses milestone approvals and contract completion until BoaFie's team reviews it and releases or refunds the escrowed funds.
- Messaging safety: BoaFie blocks messages containing phone numbers, emails, or mentions of other messaging apps (WhatsApp, Telegram, etc.) — this is enforced automatically, not optional. Users should always keep communication and payment on-platform so escrow and dispute protection actually apply.
- Fraud reporting: job posts are automatically screened for scam patterns (e.g. "pay a registration fee first"). Users can raise a dispute on a contract or email info.boafietechltd@gmail.com to report something suspicious.
- Account deletion is available from Settings once no contract is in progress.

Rules for you:
- Only discuss BoaFie and how it works. If asked something unrelated, briefly say so and steer back to how you can help with BoaFie.
- You do not have access to any specific user's account, contracts, payments, or messages — never invent specific numbers, statuses, or names. For anything account-specific, tell the user to check their dashboard, or to raise a dispute on the relevant contract, or to contact human support.
- Never ask the user for a password, OTP code, or full card/bank details — BoaFie support never needs these, and if a user brings this up, warn them not to share it with anyone.
- Keep answers short, plain-language, and friendly — 2-4 sentences unless the question genuinely needs a list.
- If you don't know or the question needs a human, say so plainly and point to info.boafietechltd@gmail.com or the Contact page.`;

@Injectable()
export class AiService {
  private readonly client: OpenAI | null;

  constructor(
    private readonly config: ConfigService,
    private readonly artisans: ArtisansRepository,
    private readonly freelancers: FreelancersRepository,
    private readonly jobs: JobsRepository,
  ) {
    const apiKey = this.config.get<string>('app.openaiApiKey');
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  private async complete(prompt: string, maxTokens: number): Promise<string> {
    if (!this.client) {
      throw new ServiceUnavailableException('AI drafting is not configured on this server yet');
    }
    let response;
    try {
      response = await this.client.chat.completions.create({
        model: MODEL,
        max_completion_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (err) {
      // Surface a clean message instead of leaking the raw OpenAI error
      // (quota/billing state, request internals) as a bare 500.
      if (err instanceof APIError) {
        throw new ServiceUnavailableException('AI drafting is temporarily unavailable — please try again shortly');
      }
      throw err;
    }
    const text = response.choices[0]?.message?.content?.trim();
    if (!text) {
      throw new ServiceUnavailableException('AI drafting failed to produce a response');
    }
    return text;
  }

  /**
   * Stateless by design: the client resends the trimmed conversation each
   * turn (see SupportChatDto's 20-message cap) rather than this persisting
   * chat history server-side — there's no support-ticket record to build
   * here, just a grounded Q&A widget.
   */
  async supportChat(messages: SupportChatMessageDto[]): Promise<string> {
    if (!this.client) {
      throw new ServiceUnavailableException('The support assistant is not configured on this server yet');
    }
    let response;
    try {
      response = await this.client.chat.completions.create({
        model: MODEL,
        max_completion_tokens: 400,
        messages: [
          { role: 'system', content: SUPPORT_SYSTEM_PROMPT },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      });
    } catch (err) {
      if (err instanceof APIError) {
        throw new ServiceUnavailableException('The support assistant is temporarily unavailable — please try again shortly');
      }
      throw err;
    }
    const text = response.choices[0]?.message?.content?.trim();
    if (!text) {
      throw new ServiceUnavailableException('The support assistant failed to produce a response');
    }
    return text;
  }

  async generateBio(dto: GenerateBioDto): Promise<string> {
    const roleLabel = dto.role === 'artisan' ? 'tradesperson/artisan' : 'freelancer';
    const lines = [
      `Write a short, warm, first-person professional bio (2-3 sentences, under 60 words) for a ${roleLabel} on BoaFie, a Ghanaian marketplace connecting clients with verified artisans and freelancers.`,
      dto.headline ? `Their trade/specialty: ${dto.headline}.` : null,
      dto.skills?.length ? `Specific skills: ${dto.skills.join(', ')}.` : null,
      dto.years_experience ? `Years of experience: ${dto.years_experience}.` : null,
      dto.location_text ? `Based in: ${dto.location_text}.` : null,
      'Write in first person ("I..."), confident but not boastful. No hashtags, no emoji, no quotation marks around the output.',
    ].filter((l): l is string => Boolean(l));
    return this.complete(lines.join('\n'), 200);
  }

  async draftProposalForJob(userId: string, role: string, jobId: string): Promise<string> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundException('Job not found');

    let workerHeadline: string | null = null;
    let workerSkills: string[] | null = null;
    if (role === 'artisan') {
      const profile = await this.artisans.findByUserId(userId);
      workerHeadline = profile?.trade_category ?? null;
      workerSkills = profile?.trade_subcategories ?? null;
    } else if (role === 'freelancer') {
      const profile = await this.freelancers.findByUserId(userId);
      workerHeadline = profile?.title ?? null;
      workerSkills = profile?.skills ?? null;
    }

    const lines = [
      'Write a short, persuasive cover letter (3-4 sentences, under 120 words) from a worker applying to a job on BoaFie, a Ghanaian marketplace connecting clients with verified artisans and freelancers.',
      `Job title: ${job.title}`,
      `Job description: ${job.description}`,
      workerHeadline ? `Applicant's trade/specialty: ${workerHeadline}` : null,
      workerSkills?.length ? `Applicant's skills: ${workerSkills.join(', ')}` : null,
      "Write in first person, connect the applicant's specific skills to this job, confident but not boastful. No hashtags, no emoji, no quotation marks around the output, no placeholder brackets like [Your Name].",
    ].filter((l): l is string => Boolean(l));
    return this.complete(lines.join('\n'), 300);
  }
}
