import fs from "node:fs";
import path from "node:path";

export type SentEmailResult = {
  ok: boolean;
  provider: "resend" | "outbox";
  accepted: boolean;
  detail: string;
};

function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getOutboxDir() {
  const dirPath = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "data",
    "saas",
    "mail-outbox"
  );
  ensureDirectory(dirPath);
  return dirPath;
}

export type EmailAttachment = {
  /** Nombre del fichero como aparecerá adjunto en el cliente de email. */
  filename: string;
  /** Contenido binario o de texto. */
  content: Buffer;
  /** Mime type, por defecto application/octet-stream. */
  contentType?: string;
};

async function sendByResend(input: {
  to: string;
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
}): Promise<SentEmailResult> {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const fromEmail = String(process.env.PRONTARA_FROM_EMAIL || "").trim();

  if (!apiKey || !fromEmail) {
    return {
      ok: false,
      provider: "outbox",
      accepted: false,
      detail: "Faltan RESEND_API_KEY o PRONTARA_FROM_EMAIL.",
    };
  }

  const body: Record<string, unknown> = {
    from: fromEmail,
    to: [input.to],
    subject: input.subject,
    text: input.text,
  };

  if (input.attachments && input.attachments.length > 0) {
    body.attachments = input.attachments.map((a) => ({
      filename: a.filename,
      content: a.content.toString("base64"),
      content_type: a.contentType || "application/octet-stream",
    }));
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    return {
      ok: false,
      provider: "resend",
      accepted: false,
      detail,
    };
  }

  return {
    ok: true,
    provider: "resend",
    accepted: true,
    detail: "Email enviado correctamente por Resend.",
  };
}

function saveInOutbox(input: {
  to: string;
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
}): SentEmailResult {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeTo = input.to.replace(/[^a-zA-Z0-9]+/g, "_");
  const filename = stamp + "__" + safeTo + ".txt";

  const filePath = path.join(getOutboxDir(), filename);
  fs.writeFileSync(
    filePath,
    [
      "TO: " + input.to,
      "SUBJECT: " + input.subject,
      input.attachments && input.attachments.length > 0
        ? "ATTACHMENTS: " +
          input.attachments.map((a) => a.filename).join(", ")
        : "",
      "",
      input.text,
    ]
      .filter(Boolean)
      .join("\n"),
    "utf8",
  );

  // También guarda los adjuntos en disco junto al .txt para inspección manual.
  if (input.attachments && input.attachments.length > 0) {
    for (const att of input.attachments) {
      const attPath = path.join(
        getOutboxDir(),
        stamp + "__" + safeTo + "__" + att.filename,
      );
      fs.writeFileSync(attPath, att.content);
    }
  }

  return {
    ok: true,
    provider: "outbox",
    accepted: false,
    detail:
      "No había proveedor real configurado. Email guardado en outbox: " + filePath,
  };
}

export async function sendPlainEmail(input: {
  to: string;
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
}): Promise<SentEmailResult> {
  const resendResult = await sendByResend(input);

  if (resendResult.ok) {
    return resendResult;
  }

  return saveInOutbox(input);
}