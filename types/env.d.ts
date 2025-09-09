declare namespace NodeJS {
    interface ProcessEnv {
      JWT_SECRET: string;             // required
      JWT_EXPIRES_IN?: string;        // optional (e.g., "7d", "1h")
    }
  }
  // src/types/nodemailer-smtp.d.ts
  declare module "nodemailer/lib/smtp-transport" {
    import SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
    export default SMTPTransport;
  }
  
  