// Envoi d'e-mails : GRATUIT par défaut, via la messagerie de l'utilisateur (lien mailto).
//
//   EmailProvider
//   ├── MailtoEmailProvider  (défaut : ouvre le message pré-rempli dans votre messagerie)
//   └── (futur, désactivé)   Resend / Brevo / Gmail / Outlook — via un proxy détenant la clé
//
// Aucun envoi automatique en masse : chaque message est ouvert, relu et envoyé par l'utilisateur.
import { mailtoUrl } from '../domain/links';

export type DeliveryStatus = 'unknown' | 'opened_in_client' | 'sent' | 'delivered' | 'failed';

export interface OutgoingEmail {
  to: string;
  subject: string;
  body: string;
}

export interface EmailProvider {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  /** Les statuts d'ouverture / clic / réponse sont-ils mesurables ? */
  readonly tracking: boolean;
  sendEmail(email: OutgoingEmail): Promise<{ id: string; status: DeliveryStatus }>;
  sendBulk(emails: OutgoingEmail[]): Promise<{ id: string; status: DeliveryStatus }[]>;
  getDeliveryStatus(id: string): Promise<DeliveryStatus>;
  getOpenStatus(id: string): Promise<boolean | null>;
  getClickStatus(id: string): Promise<boolean | null>;
  getReplyStatus(id: string): Promise<boolean | null>;
}

export class MailtoEmailProvider implements EmailProvider {
  readonly id = 'mailto';
  readonly label = 'Ma messagerie (gratuit)';
  readonly enabled = true;
  readonly tracking = false;
  private open: (url: string) => void;

  constructor(open: (url: string) => void = (url) => window.location.assign(url)) {
    this.open = open;
  }

  async sendEmail(email: OutgoingEmail) {
    this.open(mailtoUrl(email.to, email.subject, email.body));
    return { id: `mailto-${Date.now()}`, status: 'opened_in_client' as const };
  }
  async sendBulk(): Promise<never> {
    throw new Error('Envoi groupé impossible avec la messagerie : ouvrez chaque message et envoyez-le vous-même.');
  }
  async getDeliveryStatus(): Promise<DeliveryStatus> {
    return 'unknown';
  }
  async getOpenStatus() {
    return null;
  }
  async getClickStatus() {
    return null;
  }
  async getReplyStatus() {
    return null;
  }
}

export const emailProvider: EmailProvider = new MailtoEmailProvider();
