// src/utils/sendMailResend.js

import fs from "fs";
import handlebars from "handlebars";
import path from "path";

import { resend } from "./resendMailer.js";

/**
 * Sends an email using Resend with a compiled Handlebars template.
 *
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient(s)
 * @param {string|string[]} [options.cc] - CC Recipient(s)
 * @param {string|string[]} [options.bcc] - BCC Recipient(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.templateName - Handlebars template filename (without .hbs)
 * @param {Object} options.templateData - Data injected into the template
 * @param {Array<Object>} [options.attachments] - Optional list of attachments
 *
 * Each attachment object can be:
 * - { filename: string, path: string }           → file path to read and base64 encode
 * - { filename: string, content: string|Buffer } → raw base64 or buffer content
 */
export const sendMailResend = async ({
  to,
  cc,
  bcc,
  subject,
  templateName,
  templateData,
  attachments = [],
}) => {
  try {
    // Step 1: Compile Handlebars HTML
    const templatePath = path.resolve(
      "src/emails/templates",
      `${templateName}.hbs`,
    );
    const source = fs.readFileSync(templatePath, "utf8");
    const html = handlebars.compile(source)(templateData);

    // Step 2: Prepare attachments
    const formattedAttachments = attachments.map((attachment) => {
      if (attachment.path && fs.existsSync(attachment.path)) {
        return {
          filename: attachment.filename,
          content: fs.readFileSync(attachment.path).toString("base64"),
        };
      } else if (attachment.content) {
        return {
          filename: attachment.filename,
          content: Buffer.isBuffer(attachment.content)
            ? attachment.content.toString("base64")
            : attachment.content,
        };
      } else {
        throw new Error(`Invalid attachment: ${JSON.stringify(attachment)}`);
      }
    });

    // Step 3: Send email
    const { data, error } = await resend.emails.send({
      from: `"Kamdhenuseva" <kamdhenuseva@mails.dayadevraha.com>`,
      to: Array.isArray(to) ? to : [to],
      cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
      bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
      subject,
      html,
      attachments:
        formattedAttachments.length > 0 ? formattedAttachments : undefined,
    });

    if (error) {
      console.error(
        `[Resend] Failed to send "${templateName}" email to ${to}:`,
        error,
      );
      throw error;
    }

    console.log(`[Resend] Email sent successfully to ${to}: ${data.id}`);
    return data;
  } catch (err) {
    console.error(`[Resend] Unexpected error in sendMailResend:`, err);
    throw err;
  }
};
