import { EmailAddress } from "@noctf/api/datatypes";

export interface EmailProvider {
  readonly name: string;
  readonly queued: boolean;
  send(payload: EmailPayload): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validate(config: any): Promise<void>;
}

export interface EmailPayload {
  from: EmailAddress;
  to?: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  text: string;
}
