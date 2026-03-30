const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', '.playwright-mcp', 'guide');
const outDir = path.join(__dirname, '..', 'docs');

function img(name) {
  const data = fs.readFileSync(path.join(dir, name));
  return 'data:image/png;base64,' + data.toString('base64');
}

function section(id, step, title, imgName, markers, annotations, tip, blurs) {
  const markerHtml = markers.map(m =>
    `<div class="marker" style="top:${m[0]};left:${m[1]}">${m[2]}</div>`
  ).join('\n        ');

  const blurHtml = (blurs || []).map(b =>
    `<div class="blur-overlay" style="top:${b[0]};left:${b[1]};width:${b[2]};height:${b[3]}"><span>금액 비공개</span></div>`
  ).join('\n        ');

  const annotHtml = annotations.map(a =>
    `<div class="annotation"><span class="num">${a[0]}</span><div class="desc"><strong>${a[1]}</strong> — ${a[2]}</div></div>`
  ).join('\n        ');

  const tipHtml = tip ? `<div class="tip">${tip}</div>` : '';

  return `
<div class="section" id="${id}">
  <div class="section-header"><h2><span class="step">${step}</span> ${title}</h2></div>
  <div class="section-body">
    <div class="guide-row">
      <div class="guide-screenshot">
        <img src="${img(imgName)}" alt="${title}">
        ${markerHtml}
        ${blurHtml}
      </div>
      <div class="guide-annotations">
        ${annotHtml}
        ${tipHtml}
      </div>
    </div>
  </div>
</div>`;
}

const sections = [
  section('s1', 1, '로그인', '01-login.png',
    [['44%','52%',1],['54%','52%',2],['65%','52%',3]],
    [[1,'아이디','발급받은 아이디를 입력합니다'],[2,'비밀번호','발급받은 비밀번호를 입력합니다'],[3,'로그인','아이디와 비밀번호를 입력하면 활성화됩니다']],
    '아이디 저장을 체크하면 다음 방문 시 아이디가 자동 입력됩니다'),

  section('s2', 2, '홈 화면', '02-home.png',
    [['28%','88%',1],['75%','30%',2],['75%','65%',3]],
    [[1,'정보 수정 / 로그아웃','프로필 수정 및 로그아웃'],[2,'견적 요청','새로운 견적을 요청합니다. 행사/렌탈 정보를 입력하면 견적서가 자동 생성됩니다'],[3,'내 견적 현황','내가 신청한 견적서의 상태를 확인합니다']],
    null),

  section('s3', 3, '프로필 설정 (이메일 등록)', '03-profile.png',
    [['34%','52%',1],['44%','52%',2],['54%','52%',3],['86%','42%',4]],
    [[1,'이름','견적서에 표시되는 요청자명'],[2,'이메일','견적 승인 알림을 받을 이메일 주소. <em>반드시 등록하세요!</em>'],[3,'전화번호','연락처 (견적서에 자동 입력)'],[4,'저장','변경사항 저장']],
    '이메일을 등록해야 견적 승인 시 이메일 알림을 받을 수 있습니다. 프로필에 등록된 이메일이 견적 요청 시 자동으로 입력됩니다.'),

  section('s4', 4, '견적 요청', '08-request-form.png',
    [['10%','50%',1],['27%','50%',2],['40%','50%',3],['50%','45%',4],['80%','50%',5]],
    [[1,'진행 단계 표시','기본 정보 → 기능 선택 → 상세 옵션 → 미리보기 4단계'],[2,'견적 유형 선택','렌탈(기본가), 재행사(70% 할인), 판매(30% 추가) 중 선택'],[3,'행사명 (필수)','행사 이름을 입력합니다'],[4,'행사일/장소','행사 기간과 장소 정보'],[5,'요청자 정보','프로필에서 자동 입력됩니다 (이름, 이메일)']],
    '4단계를 모두 입력하면 견적이 자동 생성되어 개발팀에게 전달됩니다. 개발팀이 검토 후 승인/반려합니다.'),

  section('s5', 5, '내 견적 현황', '04-quotes-list.png',
    [['13%','50%',1],['20%','30%',2],['20%','60%',3],['27%','60%',4]],
    [[1,'상태 요약 카드','대기중, 검토중, 승인, 확정, 미진행, 반려 건수를 한눈에 확인'],[2,'상태 필터','특정 상태의 견적만 필터링'],[3,'검색','행사명, 요청자, 견적번호로 검색'],[4,'상태 배지','각 견적의 현재 상태 표시. 클릭하면 상세 페이지로 이동']],
    '승인된 견적은 클라이언트 확인 후 "확정" 또는 "미진행" 처리가 필요합니다.'),

  section('s6', 6, '견적 상세 확인', '05-quote-detail.png',
    [['6%','28%',1],['6%','52%',2],['10%','38%',3],['45%','55%',4],['63%','55%',5]],
    [[1,'견적 번호 / 상태','견적 번호, 유형(렌탈/재행사/판매), 현재 상태 표시'],[2,'Excel 다운로드','견적서를 Excel 파일로 다운로드'],[3,'견적 항목 / 금액','모듈별 단가와 합계 확인'],[4,'개발팀 검토 메모','개발팀이 남긴 검토 의견'],[5,'댓글','개발팀과 소통하는 댓글 기능. Ctrl+Enter로 빠르게 전송']],
    null),

  section('s7', 7, '행사 확정 / 미진행 처리', '06-confirm-modal.png',
    [['35%','49%',1],['41%','49%',2],['47%','49%',3],['53%','49%',4]],
    [[1,'행사 시작일','최종 확정된 행사 시작 날짜 (견적서의 행사일이 자동 입력됨)'],[2,'행사 종료일','행사 종료 날짜'],[3,'개발 마감일','개발팀이 준비 완료해야 하는 날짜. 행사 2주 전으로 자동 계산됩니다'],[4,'확정 버튼','클릭하면 행사가 확정되고, 개발팀에게 이메일 알림이 전송됩니다']],
    '클라이언트가 행사를 진행하지 않기로 하면 "미진행" 버튼을 눌러주세요. 나중에 다시 진행하게 되면 "승인 상태로 되돌리기"로 복원할 수 있습니다.'),

  section('s8', 8, '행사 달력', '07-calendar.png',
    [['7%','28%',1],['20%','30%',2],['23%','20%',3],['20%','54%',4]],
    [[1,'내 행사 달력','확정된 행사만 달력에 표시됩니다'],[2,'월 이동','좌우 화살표로 이전/다음 달 이동'],[3,'범례','렌탈(파랑), 재행사(청록), 개발마감(빨강) 색상 구분'],[4,'오늘 버튼','현재 달로 바로 이동']],
    '달력에서 이벤트를 클릭하면 견적 상세 페이지로 바로 이동합니다. 확정 처리를 하지 않은 견적은 달력에 표시되지 않습니다.'),
];

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>QuoteMaker 사업팀 가이드</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; background: #f9fafb; color: #1a1a1a; line-height: 1.6; }
  .container { max-width: 1100px; margin: 0 auto; padding: 20px; }
  .cover { text-align: center; padding: 60px 20px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; border-radius: 16px; margin-bottom: 40px; }
  .cover h1 { font-size: 32px; margin-bottom: 8px; }
  .cover p { font-size: 16px; opacity: 0.9; }
  .cover .date { margin-top: 20px; font-size: 14px; opacity: 0.7; }
  .toc { background: white; border-radius: 12px; padding: 24px 32px; margin-bottom: 40px; border: 1px solid #e5e7eb; }
  .toc h2 { font-size: 18px; margin-bottom: 16px; color: #374151; }
  .toc ol { padding-left: 20px; }
  .toc li { padding: 4px 0; color: #4b5563; }
  .toc li a { color: #3b82f6; text-decoration: none; }
  .toc li a:hover { text-decoration: underline; }
  .section { background: white; border-radius: 12px; border: 1px solid #e5e7eb; margin-bottom: 32px; overflow: hidden; page-break-inside: avoid; }
  .section-header { padding: 16px 24px; border-bottom: 1px solid #e5e7eb; background: #f8fafc; }
  .section-header h2 { font-size: 20px; color: #1e40af; display: flex; align-items: center; gap: 8px; }
  .section-header .step { background: #3b82f6; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; }
  .section-body { padding: 24px; }
  .guide-row { display: flex; gap: 24px; align-items: flex-start; }
  .guide-screenshot { flex: 1; min-width: 0; position: relative; }
  .guide-screenshot img { width: 100%; border-radius: 8px; border: 1px solid #e5e7eb; display: block; cursor: zoom-in; }
  .lightbox { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 1000; cursor: zoom-out; justify-content: center; align-items: center; padding: 24px; }
  .lightbox.active { display: flex; }
  .lightbox-content { position: relative; max-width: 95%; max-height: 95%; }
  .lightbox-content img { width: 100%; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); display: block; cursor: zoom-out; }
  .lightbox-content .marker { width: 26px; height: 26px; font-size: 14px; border: 2px solid white; }
  .lightbox-hint { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); color: rgba(255,255,255,0.6); font-size: 13px; z-index: 1001; pointer-events: none; }
  .guide-annotations { width: 320px; flex-shrink: 0; }
  .annotation { display: flex; gap: 10px; margin-bottom: 14px; align-items: flex-start; }
  .annotation .num { background: #ef4444; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0; margin-top: 2px; }
  .annotation .desc { font-size: 14px; color: #374151; }
  .annotation .desc strong { color: #1e40af; }
  .tip { margin-top: 16px; padding: 12px 16px; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 4px; font-size: 13px; color: #92400e; }
  .tip::before { content: '\\1f4a1 '; }
  .marker { position: absolute; background: #ef4444; color: white; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; border: 1.5px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); z-index: 2; transform: translate(-50%, -50%); }
  .blur-overlay { display: none; }
  .flow { text-align: center; padding: 32px; }
  .flow-items { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; align-items: center; font-size: 14px; }
  .flow-items span.step-box { padding: 8px 16px; border-radius: 8px; color: white; }
  .flow-items span.arrow { color: #9ca3af; }
  .notice { padding: 24px 28px; margin: 0; }
  .notice h2 { font-size: 18px; color: #dc2626; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .notice ul { list-style: none; padding: 0; }
  .notice li { padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #374151; display: flex; gap: 10px; align-items: flex-start; }
  .notice li:last-child { border-bottom: none; }
  .notice .icon { font-size: 18px; flex-shrink: 0; }
  @media (max-width: 768px) { .guide-row { flex-direction: column; } .guide-annotations { width: 100%; } }
  @media print { body { background: white; } .container { max-width: 100%; padding: 0; } .section { break-inside: avoid; border: 1px solid #ccc; margin-bottom: 20px; } .cover { break-after: page; } }
</style>
</head>
<body>
<div class="container">

<div class="cover">
  <h1>QuoteMaker</h1>
  <p>사업팀 사용 가이드</p>
  <div class="date">(주)하나플랫폼 &middot; 2026년 3월</div>
</div>

<div class="toc">
  <h2>목차</h2>
  <ol>
    <li><a href="#s1">로그인</a></li>
    <li><a href="#s2">홈 화면</a></li>
    <li><a href="#s3">프로필 설정 (이메일 등록)</a></li>
    <li><a href="#s4">견적 요청</a></li>
    <li><a href="#s5">내 견적 현황</a></li>
    <li><a href="#s6">견적 상세 확인</a></li>
    <li><a href="#s7">행사 확정 / 미진행 처리</a></li>
    <li><a href="#s8">행사 달력</a></li>
  </ol>
</div>

${sections.join('\n')}

<div class="section">
  <div class="section-header"><h2>전체 워크플로우</h2></div>
  <div class="flow">
    <div class="flow-items">
      <span class="step-box" style="background:#3b82f6">견적 요청</span>
      <span class="arrow">&rarr;</span>
      <span class="step-box" style="background:#eab308">대기중</span>
      <span class="arrow">&rarr;</span>
      <span class="step-box" style="background:#3b82f6">검토중</span>
      <span class="arrow">&rarr;</span>
      <span class="step-box" style="background:#22c55e">승인</span>
      <span class="arrow">&rarr;</span>
      <span class="step-box" style="background:#059669">확정 ✓</span>
    </div>
    <p style="margin-top:16px; font-size:13px; color:#6b7280;">
      승인 후 클라이언트 확인 → <strong>확정</strong>(행사 진행) 또는 <strong>미진행</strong>(행사 취소) 처리<br>
      확정 시 개발팀에게 이메일 알림 + 달력에 일정 표시
    </p>
  </div>
</div>

<div class="section">
  <div class="notice">
    <h2>&#9888;&#65039; 꼭 확인해주세요</h2>
    <ul>
      <li><span class="icon">&#9989;</span><div>견적이 <strong>승인</strong>되면 반드시 <strong>"행사 확정"</strong> 또는 <strong>"미진행"</strong> 처리를 해주세요.<br>확정 처리를 해야 개발팀 달력에 일정이 등록되고, 별도 연락 없이도 개발 작업이 자동으로 진행됩니다.</div></li>
      <li><span class="icon">&#9888;&#65039;</span><div>행사 <strong>일정이 변경</strong>되거나 <strong>취소</strong>되는 경우에는 <strong>개발팀에 별도로 연락</strong>해주세요.<br>개발팀은 시스템에 등록된 확정 일정 기준으로만 작업을 진행합니다.</div></li>
      <li><span class="icon">&#128197;</span><div><strong>개발 마감일</strong>은 행사 시작일 2주 전으로 자동 계산됩니다.<br>개발팀은 이 마감일까지 준비를 완료합니다.</div></li>
    </ul>
  </div>
</div>

</div>

<div class="lightbox" id="lightbox" onclick="this.classList.remove('active')">
  <div class="lightbox-content" id="lightbox-content"></div>
  <div class="lightbox-hint">클릭하면 닫힙니다 (ESC)</div>
</div>

<script>
document.querySelectorAll('.guide-screenshot').forEach(container => {
  container.addEventListener('click', () => {
    const clone = container.cloneNode(true);
    clone.style.cursor = 'zoom-out';
    const target = document.getElementById('lightbox-content');
    target.innerHTML = '';
    target.appendChild(clone);
    document.getElementById('lightbox').classList.add('active');
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('lightbox').classList.remove('active');
});
</script>
</body>
</html>`;

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'guide-sales.html'), html);
console.log('Guide created: docs/guide-sales.html');
console.log('Size:', Math.round(html.length / 1024) + 'KB');
