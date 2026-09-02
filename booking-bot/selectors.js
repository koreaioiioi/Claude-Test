// 실제 valet.amanopark.co.kr/booking 페이지 구조를 확인하지 못한 상태로 작성된 "자리표시자" 값입니다.
// 브라우저 개발자도구(F12) → Elements 탭에서 각 입력창을 우클릭 → Copy → Copy selector 로 확인 후
// 아래 값들을 실제 페이지에 맞게 수정해야 프로그램이 정상 동작합니다.
module.exports = {
  form: {
    name: '#name',
    phone: '#phone',
    carNumber: '#carNumber',
    date: '#date',
    time: '#time',
    submit: 'button[type="submit"]',
  },

  // 제출 후 결과를 판별하는 기준. selector 또는 text 중 하나만 있어도 됩니다.
  // - selector: 해당 요소가 나타나면 매칭
  // - text: 페이지(또는 selector 요소) 안에 해당 문구가 포함되면 매칭
  outcome: {
    success: { selector: '.result-success' },
    noSlot: { text: '마감' },
    formError: { selector: '.field-error' },
  },

  // 제출 후 위 결과들을 기다리는 최대 시간(ms). 이 시간 안에 아무 것도 매칭되지 않으면 "unknown" 처리됩니다.
  resultTimeoutMs: 8000,
};
