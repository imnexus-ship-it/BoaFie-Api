import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIError } from 'openai';
import { ArtisansRepository } from '../artisans/artisans.repository';
import { FreelancersRepository } from '../freelancers/freelancers.repository';
import { JobsRepository } from '../jobs/jobs.repository';
import { GenerateBioDto } from './dto/generate-bio.dto';

const MODEL = 'gpt-4o-mini';

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
