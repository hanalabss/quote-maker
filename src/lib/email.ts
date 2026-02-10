interface QuoteNotificationData {
  quoteNumber: string;
  eventName: string;
  requesterName: string;
  totalAmount: number;
  quoteUrl: string;
}

export async function sendQuoteNotification(data: QuoteNotificationData) {
  const notificationEmail = process.env.NOTIFICATION_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  if (!notificationEmail || !apiKey) {
    console.log("[Email] 이메일 설정 없음 - 알림 건너뜀:", data.quoteNumber);
    return null;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: "QuoteMaker <onboarding@resend.dev>",
      to: notificationEmail,
      subject: `[견적요청] ${data.eventName} - ${data.requesterName}`,
      html: `
        <!DOCTYPE html>
        <html lang="ko">
        <head><meta charset="UTF-8"></head>
        <body>
        <div style="font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">
            새 견적 요청이 도착했습니다
          </h2>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px; color: #666; width: 120px;">견적번호</td>
              <td style="padding: 8px; font-weight: bold;">${data.quoteNumber}</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 8px; color: #666;">행사명</td>
              <td style="padding: 8px;">${data.eventName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; color: #666;">요청자</td>
              <td style="padding: 8px;">${data.requesterName}</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 8px; color: #666;">견적금액(VAT포함)</td>
              <td style="padding: 8px; font-weight: bold; color: #3b82f6;">
                ${new Intl.NumberFormat("ko-KR").format(data.totalAmount)}원
              </td>
            </tr>
          </table>
          <a href="${data.quoteUrl}"
             style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
            견적 검토하기
          </a>
        </div>
        </body>
        </html>
      `,
    });
    return result;
  } catch (error) {
    console.error("[Email] 발송 실패:", error);
    return null;
  }
}
