import { EmailAddress } from "@noctf/api/datatypes";

export interface EmailProvider {
  readonly name: string;
  readonly queued: boolean;
  send(payload: EmailPayload): Promise<void>;
}

export interface EmailPayload {
  from: EmailAddress;
  to?: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
}
