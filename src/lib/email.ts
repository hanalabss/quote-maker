interface QuoteNotificationData {
  quoteNumber: string;
  eventName: string;
  requesterName: string;
  totalAmount: number;
  quoteUrl: string;
}

interface ApprovalNotificationData {
  quoteNumber: string;
  eventName: string;
  requesterName: string;
  totalAmount: number;
  quoteUrl: string;
  requesterEmail: string;
  reviewNote?: string | null;
}

interface ConfirmationNotificationData {
  quoteNumber: string;
  eventName: string;
  requesterName: string;
  totalAmount: number;
  quoteUrl: string;
  confirmedDate: string;
  devDeadline: string;
  requesterEmail?: string;
}

async function sendEmail(to: string, subject: string, html: string) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) {
    console.log("[Email] SMTP 설정 없음 - 알림 건너뜀");
    return null;
  }
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: smtpUser, pass: smtpPass },
    });
    const result = await transporter.sendMail({
      from: `QuoteMaker <${smtpUser}>`,
      to,
      subject,
      html,
    });
    console.log("[Email] 발송 성공:", result.messageId);
    return result;
  } catch (error) {
    console.error("[Email] 발송 실패:", error);
    return null;
  }
}

function emailLayout(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body>
<div style="font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">
    ${title}
  </h2>
  ${body}
</div>
</body>
</html>`;
}

function infoTable(rows: { label: string; value: string; highlight?: boolean }[]) {
  return `<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    ${rows.map((r, i) => `<tr${i % 2 === 1 ? ' style="background: #f9fafb;"' : ""}>
      <td style="padding: 8px; color: #666; width: 120px;">${r.label}</td>
      <td style="padding: 8px;${r.highlight ? " font-weight: bold; color: #3b82f6;" : ""}">${r.value}</td>
    </tr>`).join("")}
  </table>`;
}

function actionButton(url: string, label: string, color = "#3b82f6") {
  return `<a href="${url}" style="display: inline-block; padding: 12px 24px; background: ${color}; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">${label}</a>`;
}

// DB에서 개발팀 이메일 동적 조회
async function getDevEmails(roles: string[] = ["dev"]): Promise<string[]> {
  const { prisma } = await import("@/lib/db");
  const users = await prisma.user.findMany({
    where: { role: { in: roles } },
    select: { email: true },
  });
  return users.map((u) => u.email).filter(Boolean);
}

// 견적 생성 시 → admin(dev)에게
export async function sendQuoteNotification(data: QuoteNotificationData) {
  const emails = await getDevEmails(["dev"]);
  if (emails.length === 0) {
    console.log("[Email] dev 유저 없음 - 알림 건너뜀:", data.quoteNumber);
    return null;
  }

  return sendEmail(
    emails.join(","),
    `[견적요청] ${data.eventName} - ${data.requesterName}`,
    emailLayout("새 견적 요청이 도착했습니다", `
      ${infoTable([
        { label: "견적번호", value: data.quoteNumber },
        { label: "행사명", value: data.eventName },
        { label: "요청자", value: data.requesterName },
        { label: "견적금액(VAT포함)", value: `${new Intl.NumberFormat("ko-KR").format(data.totalAmount)}원`, highlight: true },
      ])}
      ${actionButton(data.quoteUrl, "견적 검토하기")}
    `)
  );
}

// 승인 시 → 요청자 + 개발팀에게
export async function sendApprovalNotification(data: ApprovalNotificationData) {
  const reviewNoteHtml = data.reviewNote
    ? `<div style="margin: 16px 0; padding: 12px 16px; background: #f8fafc; border-left: 3px solid #f59e0b; border-radius: 4px;">
        <div style="font-size: 12px; color: #92400e; margin-bottom: 4px; font-weight: bold;">개발팀 검토 메모</div>
        <div style="font-size: 14px; color: #374151; white-space: pre-wrap;">${data.reviewNote}</div>
      </div>`
    : "";

  const htmlContent = emailLayout("견적이 승인되었습니다", `
    ${infoTable([
      { label: "견적번호", value: data.quoteNumber },
      { label: "행사명", value: data.eventName },
      { label: "요청자", value: data.requesterName },
      { label: "견적금액(VAT포함)", value: `${new Intl.NumberFormat("ko-KR").format(data.totalAmount)}원`, highlight: true },
    ])}
    ${reviewNoteHtml}
    <p style="font-size: 14px; color: #374151; margin-top: 16px;">
      클라이언트 확인 후 <strong>확정</strong> 또는 <strong>미진행</strong> 처리를 진행해주세요.
    </p>
    ${actionButton(data.quoteUrl, "견적 확인하기")}
  `);

  const subject = `[견적승인] ${data.eventName} - 견적이 승인되었습니다`;

  // 요청자에게 발송
  if (data.requesterEmail) {
    await sendEmail(data.requesterEmail, subject, htmlContent);
  }

  // 개발팀에게도 발송
  const devEmails = await getDevEmails(["dev"]);
  if (devEmails.length > 0) {
    await sendEmail(devEmails.join(","), subject, htmlContent);
  }
}

// 확정 시 → 개발팀 + 요청자에게
export async function sendConfirmationNotification(data: ConfirmationNotificationData) {
  const htmlContent = emailLayout("행사가 확정되었습니다", `
    ${infoTable([
      { label: "견적번호", value: data.quoteNumber },
      { label: "행사명", value: data.eventName },
      { label: "요청자", value: data.requesterName },
      { label: "견적금액(VAT포함)", value: `${new Intl.NumberFormat("ko-KR").format(data.totalAmount)}원`, highlight: true },
      { label: "최종 행사일", value: data.confirmedDate },
      { label: "개발 마감일", value: `<strong style="color: #dc2626;">${data.devDeadline}</strong>` },
    ])}
    ${actionButton(data.quoteUrl, "견적 상세보기", "#059669")}
  `);

  const subject = `[행사확정] ${data.eventName} - 마감일: ${data.devDeadline}`;

  // 개발팀에게 발송
  const devEmails = await getDevEmails(["dev", "dev_staff"]);
  if (devEmails.length > 0) {
    await sendEmail(devEmails.join(","), subject, htmlContent);
  }

  // 요청자에게도 발송
  if (data.requesterEmail) {
    await sendEmail(data.requesterEmail, subject, htmlContent);
  }
}
