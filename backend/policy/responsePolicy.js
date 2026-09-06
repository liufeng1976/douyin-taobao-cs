const HIGH_RISK_PATTERNS = [
  { code: 'refund_or_return', pattern: /(退款|退货|退钱|退差价|仅退款|退换|refund|return)/i },
  { code: 'cancel_or_modify_order', pattern: /(取消订单|改地址|修改地址|改订单|换货|补发|重发|cancel|change.*order|replace)/i },
  { code: 'compensation_or_dispute', pattern: /(赔偿|赔付|补偿|投诉|差评|举报|平台介入|chargeback|compensation|complaint|dispute)/i },
  { code: 'payment_or_account', pattern: /(支付异常|扣款|银行卡|账户|账号|密码|验证码|付款失败|payment|account|password|verification code)/i },
  { code: 'legal_or_safety', pattern: /(律师|法院|起诉|法律|监管|工商|人身|受伤|过敏|危险|报警|legal|court|injury|unsafe)/i },
  { code: 'privacy_or_pii', pattern: /(身份证|手机号|家庭住址|收货地址|隐私|个人信息|identity card|phone number|address|privacy)/i },
];

const INFORMATIONAL_PATTERNS = [
  { code: 'shipping_info', pattern: /(什么时候发货|多久发货|什么快递|物流怎么查|发货时间|shipping|delivery|tracking)/i },
  { code: 'product_info', pattern: /(规格|尺寸|颜色|材质|怎么用|适合|库存|product|size|color|material|stock)/i },
  { code: 'greeting', pattern: /^(你好|您好|在吗|hi|hello|hey)[！!。.\s]*$/i },
];

function evaluateMessage(message, declaredIntent = '') {
  const source = `${String(declaredIntent || '')} ${String(message || '')}`.trim();
  const highRisk = HIGH_RISK_PATTERNS.filter((item) => item.pattern.test(source)).map((item) => item.code);
  if (highRisk.length) {
    return {
      policy: 'human_review_required',
      risk: 'high',
      reasons: highRisk,
      automaticSendAllowed: false,
      externalMutationAllowed: false,
      reviewRequired: true,
    };
  }

  const informational = INFORMATIONAL_PATTERNS.find((item) => item.pattern.test(source));
  return {
    policy: 'reviewable_draft_only',
    risk: informational ? 'low' : 'medium',
    reasons: informational ? [informational.code] : ['unclassified_support_message'],
    automaticSendAllowed: false,
    externalMutationAllowed: false,
    reviewRequired: true,
  };
}

function assertNoAutomaticSend() {
  return {
    automaticCustomerMessageSend: false,
    automaticRefund: false,
    automaticCancellation: false,
    automaticReplacement: false,
    automaticCompensation: false,
    automaticOrderMutation: false,
    automaticAccountMutation: false,
    approvalAuthority: 'canonical-bossai-customer-service-human-review',
  };
}

module.exports = { evaluateMessage, assertNoAutomaticSend, HIGH_RISK_PATTERNS };
