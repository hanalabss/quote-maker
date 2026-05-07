// nodemailer ambient declaration (실제 패키지 install 후 제거)
declare module "nodemailer" {
  interface SendMailResult {
    messageId: string;
  }
  interface Transporter {
    sendMail(options: {
      from?: string;
      to: string;
      subject: string;
      html?: string;
      text?: string;
    }): Promise<SendMailResult>;
  }
  export function createTransport(options: {
    service?: string;
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
  }): Transporter;
  const _default: { createTransport: typeof createTransport };
  export default _default;
}
