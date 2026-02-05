import emailjs from "@emailjs/browser";

type EmailJsEnv = {
  serviceId: string;
  templateId: string;
  publicKey: string;
};

function getEmailJsEnv(): EmailJsEnv {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID as
    | string
    | undefined;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as
    | string
    | undefined;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as
    | string
    | undefined;

  if (!serviceId || !templateId || !publicKey) {
    throw new Error(
      "EmailJS env is missing. Set VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY.",
    );
  }

  return { serviceId, templateId, publicKey };
}

const FIELD_LABELS: Record<string, string> = {
  form_name: "Form",
  package_name: "Package",
  package_category: "Category",
  first_name: "First name",
  last_name: "Last name",
  full_name: "Name",
  company: "Company",
  company_name: "Company name",
  company_site: "Company site",
  company_linkedin: "Company LinkedIn",
  role: "Role",
  partner_type: "Partner type",
  linkedin: "LinkedIn",
  address: "Address",
  reply_to: "Email (reply to this)",
  phone: "Phone",
  topic: "Topic",
  message: "Message",
  to_email: "To email",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formDataToParams(formData: FormData): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    params[key] = String(value ?? "").trim();
  }

  // One variable for the whole email body — use {{form_content}} in EmailJS template
  const lines: string[] = [];
  const tableRows: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (key === "to_email" || key === "form_name" || value === "") continue;
    const label = FIELD_LABELS[key] ?? key;
    lines.push(`${label}: ${value}`);

    tableRows.push(
      [
        "<tr>",
        '<td style="padding: 10px 14px; width: 34%; color: #6b7280; border-bottom: 1px solid #f3f4f6;">',
        escapeHtml(label),
        "</td>",
        '<td style="padding: 10px 14px; border-bottom: 1px solid #f3f4f6; color: #111827;">',
        escapeHtml(value),
        "</td>",
        "</tr>",
      ].join(""),
    );
  }

  params.form_content = lines.join("\n\n").trim();
  params.fields = params.form_content;
  params.form_rows_html = tableRows.join("");
  params.page_url = typeof window !== "undefined" ? window.location.href : "";

  return params;
}

export async function sendEmailJsForm(form: HTMLFormElement): Promise<void> {
  const { serviceId, templateId, publicKey } = getEmailJsEnv();

  const formData = new FormData(form);
  const templateParams = formDataToParams(formData);

  await emailjs.send(serviceId, templateId, templateParams, {
    publicKey,
  });
}
