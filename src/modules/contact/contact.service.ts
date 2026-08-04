import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Injectable()
export class ContactService {
  private readonly resendClient: Resend | null;
  private readonly resendFromEmail: string;
  private readonly contactEmail: string;

  constructor(config: ConfigService) {
    const resendApiKey = config.get<string>('app.resendApiKey');
    this.resendClient = resendApiKey ? new Resend(resendApiKey) : null;
    this.resendFromEmail = config.get<string>('app.resendFromEmail') ?? 'BoaFie <onboarding@resend.dev>';
    this.contactEmail = config.get<string>('app.contactEmail') ?? 'info.boafietechltd@gmail.com';
  }

  async send(dto: CreateContactMessageDto) {
    if (this.resendClient) {
      const { error } = await this.resendClient.emails.send({
        from: this.resendFromEmail,
        to: this.contactEmail,
        replyTo: dto.email,
        subject: `Contact form: ${dto.name}`,
        text: `${dto.message}\n\n—\nFrom: ${dto.name} <${dto.email}>`,
      });
      // Resend's SDK doesn't throw on API errors — it returns { error } instead.
      if (error) throw new ServiceUnavailableException(`Failed to send message: ${error.message}`);
      return { sent: true };
    }
    // eslint-disable-next-line no-console
    console.log(`[dev contact stub] Message from ${dto.name} <${dto.email}> to ${this.contactEmail}: ${dto.message}`);
    return { sent: true };
  }
}
