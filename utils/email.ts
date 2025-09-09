// email.service.ts
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
dotenv.config();

export interface IEmail {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

function parseBool(v: unknown) {
  const s = String(v ?? "").toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

const buildTransporter = () => {
  const host  = process.env.SMTP_HOST || "smtp.gmail.com";
  const port  = Number(process.env.SMTP_PORT ?? 587);
  const secure = port === 465 || parseBool(process.env.SMTP_SECURE);
  const user  = process.env.SMTP_USER ?? "";
  const pass  = process.env.SMTP_PASS ?? "";

const opts: SMTPTransport.Options = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "test@example.com",
    pass: "password",
  },
};
const transporter = nodemailer.createTransport(opts);
  return nodemailer.createTransport(opts);
};

export const sendEmail = async ({ to, subject, text, html }: IEmail): Promise<void> => {
  const fromEmail = process.env.FROM_EMAIL ?? process.env.SMTP_USER ?? "";
  const appName   = process.env.APP_NAME || "Exam Portal";

  const primary = buildTransporter();

  try {
    const info = await primary.sendMail({
      from: `"${appName}" <${fromEmail}>`,
      to,
      subject,
      text,
      html,
    });
    console.log("📧 Email sent:", info.messageId);
  } catch (e1: any) {
    console.error("⚠️ Primary transport failed:", e1?.message);

    // fallback to SMTPS 465

const fallback = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
  },
  connectionTimeout: 20_000,
  greetingTimeout: 10_000,
  socketTimeout: 30_000,
  tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
});



    try {
      const info2 = await fallback.sendMail({
        from: `"${appName}" <${fromEmail}>`,
        to,
        subject,
        text,
        html,
      });
      console.log("📧 Email sent via fallback:", info2.messageId);
    } catch (e2: any) {
      console.error("❌ Email send error:", e2?.message);
      throw new Error("Unable to send email: " + e2?.message);
    }
  }
};
