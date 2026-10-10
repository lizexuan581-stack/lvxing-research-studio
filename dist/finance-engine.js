(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.LXEngine = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof self !== "undefined" ? self : this), function () {
  "use strict";

  var VERSION = "1.0.0-demo";
  var BASELINE_REVENUE_WAN = 2934.75;
  var BASELINE_FEN = 2934750000n;
  var INQUIRY_URL = "https://static.cninfo.com.cn/finalpage/2026-05-16/1225311608.PDF";
  var ANNUAL_URL = "https://static.cninfo.com.cn/finalpage/2026-04-28/1225214704.PDF";
  var HALF_YEAR_URL = "https://static.sse.com.cn/disclosure/listedinfo/announcement/c/new/2026-08-29/603776_20260829_4NFW.pdf";

  var FACTS = [
    {
      id: "cz_revenue_2024",
      label: "常州共享出行业务收入",
      value: 4222.78,
      unit: "万元",
      period: "2024年",
      scope: "常州地区共享出行业务",
      source: "关于永安行科技股份有限公司向特定对象发行股票申请文件的审核问询函的回复",
      url: INQUIRY_URL,
      location: "PDF第57页（文件内编号7-1-56）"
    },
    {
      id: "cz_revenue_2025",
      label: "常州共享出行业务收入",
      value: 2934.75,
      unit: "万元",
      period: "2025年",
      scope: "常州地区共享出行业务",
      source: "关于永安行科技股份有限公司向特定对象发行股票申请文件的审核问询函的回复",
      url: INQUIRY_URL,
      location: "PDF第57页（文件内编号7-1-56）"
    },
    {
      id: "shared_orders_2024",
      label: "共享出行业务订单量",
      value: 6719.30,
      unit: "万笔",
      period: "2024年",
      scope: "全国共享出行业务",
      source: "关于永安行科技股份有限公司向特定对象发行股票申请文件的审核问询函的回复",
      url: INQUIRY_URL,
      location: "PDF第58页（文件内编号7-1-57）"
    },
    {
      id: "shared_orders_2025",
      label: "共享出行业务订单量",
      value: 3806.05,
      unit: "万笔",
      period: "2025年",
      scope: "全国共享出行业务",
      source: "关于永安行科技股份有限公司向特定对象发行股票申请文件的审核问询函的回复",
      url: INQUIRY_URL,
      location: "PDF第58页（文件内编号7-1-57）"
    },
    {
      id: "shared_price_2024",
      label: "共享出行业务订单平均单价",
      value: 1.60,
      unit: "元/笔",
      period: "2024年",
      scope: "全国共享出行业务",
      source: "关于永安行科技股份有限公司向特定对象发行股票申请文件的审核问询函的回复",
      url: INQUIRY_URL,
      location: "PDF第59页"
    },
    {
      id: "shared_price_2025",
      label: "共享出行业务订单平均单价",
      value: 2.16,
      unit: "元/笔",
      period: "2025年",
      scope: "全国共享出行业务",
      source: "关于永安行科技股份有限公司向特定对象发行股票申请文件的审核问询函的回复",
      url: INQUIRY_URL,
      location: "PDF第59页"
    },
    {
      id: "shared_revenue_2024",
      label: "共享出行业务收入",
      value: 10752.02,
      unit: "万元",
      period: "2024年",
      scope: "全国共享出行业务",
      source: "关于永安行科技股份有限公司向特定对象发行股票申请文件的审核问询函的回复",
      url: INQUIRY_URL,
      location: "PDF第59页"
    },
    {
      id: "shared_revenue_2025",
      label: "共享出行业务收入",
      value: 8232.51,
      unit: "万元",
      period: "2025年",
      scope: "全国共享出行业务",
      source: "永安行科技股份有限公司2025年年度报告",
      url: ANNUAL_URL,
      location: "PDF第24页"
    },
    {
      id: "shared_cost_2025",
      label: "共享出行业务成本",
      value: 11630.34,
      unit: "万元",
      period: "2025年",
      scope: "全国共享出行业务",
      source: "永安行科技股份有限公司2025年年度报告",
      url: ANNUAL_URL,
      location: "PDF第24页"
    },
    {
      id: "company_revenue_2026_h1",
      label: "公司营业收入",
      value: 32165.93,
      unit: "万元",
      period: "2026年上半年",
      scope: "永安行合并口径",
      source: "永安行科技股份有限公司2026年半年度报告",
      url: HALF_YEAR_URL,
      location: "PDF第6页"
    },
    {
      id: "system_sales_revenue_2026_h1",
      label: "系统销售业务收入",
      value: 19721.27,
      unit: "万元",
      period: "2026年上半年",
      scope: "系统销售业务",
      source: "永安行科技股份有限公司2026年半年度报告",
      url: HALF_YEAR_URL,
      location: "PDF第149页"
    },
    {
      id: "shared_revenue_2026_h1",
      label: "共享出行业务收入",
      value: 3140.92,
      unit: "万元",
      period: "2026年上半年",
      scope: "全国共享出行业务",
      source: "永安行科技股份有限公司2026年半年度报告",
      url: HALF_YEAR_URL,
      location: "PDF第149页"
    }
  ];

  function assertFiniteNumber(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError(name + "必须是有限数字");
    }
  }

  function decimalFraction(value, name) {
    assertFiniteNumber(value, name);
    var text = String(value);
    var match = text.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
    if (!match) {
      throw new TypeError(name + "不是可计算的十进制数字");
    }
    var sign = match[1] === "-" ? -1n : 1n;
    var integer = match[2];
    var fraction = match[3] || "";
    var exponent = Number(match[4] || "0");
    var digits = BigInt((integer + fraction).replace(/^0+(?=\d)/, "") || "0");
    var scalePower = fraction.length - exponent;
    if (scalePower >= 0) {
      return { numerator: sign * digits, denominator: 10n ** BigInt(scalePower) };
    }
    return { numerator: sign * digits * (10n ** BigInt(-scalePower)), denominator: 1n };
  }

  function divideRoundHalfUp(numerator, denominator) {
    if (denominator <= 0n) {
      throw new RangeError("除数必须大于零");
    }
    var negative = numerator < 0n;
    var absolute = negative ? -numerator : numerator;
    var rounded = (absolute + denominator / 2n) / denominator;
    return negative ? -rounded : rounded;
  }

  function productFen(ordersWan, yuanPerOrder) {
    var orders = decimalFraction(ordersWan, "订单量");
    var price = decimalFraction(yuanPerOrder, "单价或成本");
    var numerator = orders.numerator * price.numerator * 1000000n;
    var denominator = orders.denominator * price.denominator;
    return divideRoundHalfUp(numerator, denominator);
  }

  function wanToFen(value, name) {
    var amount = decimalFraction(value, name);
    return divideRoundHalfUp(amount.numerator * 1000000n, amount.denominator);
  }

  function fenToWan2(fen) {
    var hundredthWan = divideRoundHalfUp(fen, 10000n);
    var output = Number(hundredthWan) / 100;
    if (!Number.isFinite(output)) {
      throw new RangeError("计算结果超出可展示范围");
    }
    return Object.is(output, -0) ? 0 : output;
  }

  function normaliseParams(params) {
    var source = params || {};
    var inputs = {
      paidOrdersWan: source.paidOrdersWan === undefined ? 30 : source.paidOrdersWan,
      freeOrdersWan: source.freeOrdersWan === undefined ? 0 : source.freeOrdersWan,
      price: source.price === undefined ? 2.16 : source.price,
      cost: source.cost === undefined ? null : source.cost,
      compensation: source.compensation === undefined ? 0 : source.compensation,
      contractVerified: source.contractVerified === undefined ? false : source.contractVerified
    };

    assertFiniteNumber(inputs.paidOrdersWan, "paidOrdersWan");
    assertFiniteNumber(inputs.freeOrdersWan, "freeOrdersWan");
    assertFiniteNumber(inputs.price, "price");
    assertFiniteNumber(inputs.compensation, "compensation");
    if (inputs.cost !== null) {
      assertFiniteNumber(inputs.cost, "cost");
    }
    if (inputs.freeOrdersWan < 0) {
      throw new RangeError("freeOrdersWan不能为负数");
    }
    if (inputs.price < 0) {
      throw new RangeError("price不能为负数");
    }
    if (inputs.cost !== null && inputs.cost < 0) {
      throw new RangeError("cost不能为负数");
    }
    if (inputs.compensation < 0) {
      throw new RangeError("compensation不能为负数");
    }
    if (typeof inputs.contractVerified !== "boolean") {
      throw new TypeError("contractVerified必须是布尔值");
    }
    return inputs;
  }

  function calculate(params) {
    var inputs = normaliseParams(params);
    var warnings = [];
    var paidRevenueFen = productFen(inputs.paidOrdersWan, inputs.price);
    var verifiedCompensationFen = inputs.contractVerified
      ? wanToFen(inputs.compensation, "compensation")
      : 0n;
    var deltaRevenueFen = paidRevenueFen + verifiedCompensationFen;

    if (inputs.price === 2.16) {
      warnings.push("2.16元/笔为全国共享出行业务均价代理，不是常州付费订单实收价。");
    } else {
      warnings.push("情景单价为输入参数，不代表常州付费订单实收价。");
    }
    if (inputs.compensation > 0 && !inputs.contractVerified) {
      warnings.push("补偿金额未通过合同核验，未计入增量收入。");
    }
    if (inputs.freeOrdersWan > 0 && (!inputs.contractVerified || inputs.compensation === 0)) {
      warnings.push("免费订单缺少已核实的付款或补偿依据，未计入营业收入。");
    }

    var contributionWan = null;
    if (inputs.paidOrdersWan < 0) {
      warnings.push("负向收费订单情景未建立成本节约假设，增量经营贡献保留为空。");
    } else if (inputs.cost === null) {
      warnings.push("未提供单笔边际成本，增量经营贡献保留为空。");
    } else {
      var paidCostFen = productFen(inputs.paidOrdersWan, inputs.cost);
      var freeCostFen = productFen(inputs.freeOrdersWan, inputs.cost);
      contributionWan = fenToWan2(deltaRevenueFen - paidCostFen - freeCostFen);
      warnings.push("增量经营贡献尚未扣除税费、资本开支和营运资金变化，不等于净利润或自由现金流。");
    }

    return {
      deltaRevenueWan: fenToWan2(deltaRevenueFen),
      totalRevenueWan: fenToWan2(BASELINE_FEN + deltaRevenueFen),
      contributionWan: contributionWan,
      warnings: warnings,
      inputs: {
        paidOrdersWan: inputs.paidOrdersWan,
        freeOrdersWan: inputs.freeOrdersWan,
        price: inputs.price,
        cost: inputs.cost,
        compensation: inputs.compensation,
        contractVerified: inputs.contractVerified
      }
    };
  }

  function stableHash(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
  }

  function buildMemo(inputs, calculation, scenarios) {
    var compensationText = inputs.contractVerified && inputs.compensation > 0
      ? "已核实服务补偿" + inputs.compensation + "万元已计入收入"
      : "未取得已核实服务补偿";
    var contributionText = calculation.contributionWan === null
      ? "当前条件不足以计算增量经营贡献"
      : "增量经营贡献为" + calculation.contributionWan.toFixed(2) + "万元，该数值不等于净利润或自由现金流";
    var scenarioText = scenarios.map(function (scenario) {
      var value = scenario.calculation.deltaRevenueWan.toFixed(2);
      return scenario.name + "情景增量收入" + value + "万元";
    }).join("，");
    return "本次情景以2025年常州共享出行业务收入2934.75万元为基准。收费订单净变化为" +
      inputs.paidOrdersWan + "万笔，免费订单变化为" + inputs.freeOrdersWan + "万笔，情景单价为" +
      inputs.price + "元/笔；" + compensationText + "。测算得到增量收入" +
      calculation.deltaRevenueWan.toFixed(2) + "万元，情景后收入" + calculation.totalRevenueWan.toFixed(2) +
      "万元。" + contributionText + "。标准化三情景使用同一订单幅度、单价和成本口径：" + scenarioText +
      "。三情景用于比较收费需求减少、免费服务增加和收费需求增加三种独立机制，不是对任意输入参数进行同比。" +
      "历史事实显示，2026年上半年公司营业收入同比增长66.52%，共享出行业务收入同比下降22.78%；共享业务成本下降推动毛亏收窄，但需求修复仍待验证。" +
      "后续重点跟踪常州收费订单、城市实收价、服务补偿合同、单笔边际成本、车辆利用率以及应收账款回款。" +
      "所有结果均为条件性测算，不构成常州订单预测或投资建议。";
  }

  function buildStandardScenarios(inputs) {
    var magnitude = Math.abs(inputs.paidOrdersWan);
    var definitions = [
      {
        name: "负向",
        paidOrdersWan: -magnitude,
        freeOrdersWan: 0,
        price: inputs.price,
        cost: inputs.cost,
        compensation: 0,
        contractVerified: false
      },
      {
        name: "中性",
        paidOrdersWan: 0,
        freeOrdersWan: magnitude,
        price: inputs.price,
        cost: inputs.cost,
        compensation: 0,
        contractVerified: false
      },
      {
        name: "正向",
        paidOrdersWan: magnitude,
        freeOrdersWan: 0,
        price: inputs.price,
        cost: inputs.cost,
        compensation: 0,
        contractVerified: false
      }
    ];
    return definitions.map(function (definition) {
      return {
        name: definition.name,
        paidOrdersWan: definition.paidOrdersWan,
        freeOrdersWan: definition.freeOrdersWan,
        price: definition.price,
        cost: definition.cost,
        compensation: definition.compensation,
        contractVerified: definition.contractVerified,
        calculation: calculate(definition)
      };
    });
  }

  function buildRun(params) {
    var calculation = calculate(params);
    var scenarios = buildStandardScenarios(calculation.inputs);
    var inputKey = JSON.stringify(calculation.inputs);
    return {
      runId: "LX-DEMO-" + stableHash(VERSION + "|" + inputKey),
      version: VERSION,
      inputs: calculation.inputs,
      facts: FACTS.map(function (item) { return Object.assign({}, item); }),
      calculation: {
        deltaRevenueWan: calculation.deltaRevenueWan,
        totalRevenueWan: calculation.totalRevenueWan,
        contributionWan: calculation.contributionWan,
        warnings: calculation.warnings.slice()
      },
      scenarios: scenarios,
      memo: buildMemo(calculation.inputs, calculation, scenarios),
      events: [
        { stage: "读取固定公开事实包", status: "完成" },
        { stage: "校验情景输入", status: "完成" },
        { stage: "执行确定性财务计算", status: "完成" },
        { stage: "应用免费订单与补偿限制", status: "完成" },
        { stage: "生成研究摘要与结构化日志", status: "完成" }
      ],
      scope: {
        mode: "离线固定公开事实包",
        company: "永安行科技股份有限公司",
        city: "常州",
        business: "共享出行业务",
        baseline: "2025年常州共享出行业务收入2934.75万元",
        boundaries: [
          "不自动解析任意PDF",
          "不调用大语言模型",
          "不将免费订单直接计入收入",
          "不输出目标价或投资建议"
        ],
        scenarioDefinition: "三情景使用相同订单幅度、价格与成本口径，分别表示收费订单减少、无补偿免费订单增加和收费订单增加，不是同比结果。"
      }
    };
  }

  return Object.freeze({
    version: VERSION,
    baselineRevenueWan: BASELINE_REVENUE_WAN,
    facts: FACTS.map(function (item) { return Object.freeze(Object.assign({}, item)); }),
    calculate: calculate,
    buildRun: buildRun
  });
});

