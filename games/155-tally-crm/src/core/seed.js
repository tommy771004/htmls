/* seed · 山嵐感測科技業務團隊的示範資料
   固定種子 PRNG；所有日期相對於執行當天產生，任何時候打開都新鮮。 */
(function () {
  'use strict';
  const CRM = (window.CRM = window.CRM || {});
  const U = CRM.util;

  /* ── 常數 ─────────────────────────────────────────── */
  const PRODUCTS = [
    { sku: 'AQ-7', name: '室內空品感測器（CO₂／PM2.5／溫濕度）', short: '空品感測器', price: 6800, unit: '台' },
    { sku: 'VB-3', name: '馬達振動監測模組', short: '振動監測模組', price: 14500, unit: '組' },
    { sku: 'EM-2', name: '三相智慧電表', short: '智慧電表', price: 9200, unit: '台' },
    { sku: 'CT-4', name: '冷鏈溫度記錄器', short: '溫度記錄器', price: 4300, unit: '台' },
    { sku: 'GW-1', name: '工業閘道器（4G／LoRa）', short: '工業閘道器', price: 22000, unit: '台' },
    { sku: 'SV-P', name: '場勘與安裝服務（每場域）', short: '場勘安裝', price: 35000, unit: '場域' },
    { sku: 'CL-Y', name: '嵐雲監控平台年約（每場域）', short: '平台年約', price: 96000, unit: '場域' },
  ];
  const STAGES = [
    { id: 'lead', name: '新線索', p: 0.1, color: 'var(--st-lead)' },
    { id: 'qual', name: '需求確認', p: 0.2, color: 'var(--st-qual)' },
    { id: 'poc', name: '場勘 PoC', p: 0.4, color: 'var(--st-poc)' },
    { id: 'prop', name: '報價', p: 0.6, color: 'var(--st-prop)' },
    { id: 'nego', name: '議價', p: 0.8, color: 'var(--st-nego)' },
    { id: 'won', name: '成交', p: 1, color: 'var(--st-won)', closed: true },
    { id: 'lost', name: '未成', p: 0, color: 'var(--st-lost)', closed: true },
  ];
  const REPS = [
    { id: 'u1', name: '周品妤', title: '業務主管', region: '北區', target: 9000000, email: 'pinyu.chou@shanlan.com.tw', me: true },
    { id: 'u2', name: '蔡承翰', title: '業務代表', region: '北區', target: 8000000, email: 'chenghan.tsai@shanlan.com.tw' },
    { id: 'u3', name: '郭怡萱', title: '業務代表', region: '中區', target: 7500000, email: 'yihsuan.kuo@shanlan.com.tw' },
    { id: 'u4', name: '黃冠廷', title: '業務代表', region: '中區', target: 7500000, email: 'kuanting.huang@shanlan.com.tw' },
    { id: 'u5', name: '李佳穎', title: '業務代表', region: '南區', target: 7000000, email: 'chiaying.lee@shanlan.com.tw' },
    { id: 'u6', name: '謝孟哲', title: '業務代表', region: '南區', target: 6000000, email: 'mengche.hsieh@shanlan.com.tw' },
  ];
  const TEAM_TARGET = 45000000;
  const LIFECYCLES = ['潛在', '洽談中', '客戶', '合作夥伴', '流失'];
  const COMPANY_STATUSES = ['潛在', '洽談中', '客戶', '流失'];
  const TAGS = ['決策者', '技術窗口', '採購', '財務', '轉介來源', '2026 自動化展'];
  const LOST_REASONS = ['價格', '預算凍結', '選擇競品', '時程延後', '無回應', '其他'];
  const ACTIVITY_TYPES = [
    { id: 'call', name: '通話', icon: 'phone' },
    { id: 'email', name: 'Email', icon: 'mail' },
    { id: 'meeting', name: '會議', icon: 'meeting' },
    { id: 'note', name: '筆記', icon: 'note' },
    { id: 'stage', name: '階段變更', icon: 'stage' },
    { id: 'task', name: '任務完成', icon: 'check' },
  ];
  const PRIORITIES = [
    { id: 'high', name: '高' },
    { id: 'normal', name: '一般' },
    { id: 'low', name: '低' },
  ];

  // [名稱, 城市, 產業, 規模, 網域, 負責業務, 區域, 電話區碼]
  const COMPANY_DEFS = [
    ['豐穗精機股份有限公司', '台中市西屯區', '工具機', 320, 'fengsui-mt.com.tw', 'u3', '中區', '04'],
    ['南瀛食品工業', '台南市新營區', '食品製造', 540, 'nanying-foods.com.tw', 'u5', '南區', '06'],
    ['湖畔棲境酒店', '南投縣魚池鄉', '飯店', 210, 'lakeside-retreat.com.tw', 'u4', '中區', '049'],
    ['瑞光紀念醫院', '高雄市苓雅區', '醫療', 1800, 'ruikuang-hosp.com.tw', 'u5', '南區', '07'],
    ['竹塹微電子', '新竹縣竹北市', '半導體封測', 950, 'chuchien-micro.com.tw', 'u1', '北區', '03'],
    ['港都冷鏈物流', '高雄市前鎮區', '物流倉儲', 380, 'harborcold.com.tw', 'u6', '南區', '07'],
    ['北辰科技大學', '新北市泰山區', '學校', 620, 'beichen-tech.com.tw', 'u2', '北區', '02'],
    ['明潭國際商旅', '台北市中山區', '飯店', 160, 'mingtan-hotel.com.tw', 'u2', '北區', '02'],
    ['禾豐紡織', '彰化縣和美鎮', '紡織', 460, 'hefeng-textile.com.tw', 'u4', '中區', '04'],
    ['晴川生技', '台南市安南區', '生技製藥', 290, 'qingchuan-bio.com.tw', 'u6', '南區', '06'],
    ['大肚山資料中心', '台中市大肚區', '資料中心', 85, 'dadushan-dc.com.tw', 'u3', '中區', '04'],
    ['桐林木器', '苗栗縣三義鄉', '家具製造', 120, 'tonglin-wood.com.tw', 'u4', '中區', '037'],
    ['鼎泰塑膠工業', '桃園市觀音區', '塑膠射出', 410, 'dingtai-plastic.com.tw', 'u1', '北區', '03'],
    ['安和聯合診所', '台北市大安區', '醫療', 70, 'anhe-clinic.com.tw', 'u2', '北區', '02'],
    ['旭陽光電', '台南市善化區', '光電', 1200, 'xuyang-opto.com.tw', 'u5', '南區', '06'],
    ['蘭陽農產合作社', '宜蘭縣五結鄉', '農產加工', 95, 'lanyang-coop.com.tw', 'u2', '北區', '03'],
    ['信義雲端辦公', '台北市信義區', '商辦管理', 140, 'xinyi-cloudoffice.com.tw', 'u1', '北區', '02'],
    ['淡水河岸建設', '新北市淡水區', '營建', 230, 'tamsui-riverside.com.tw', 'u2', '北區', '02'],
    ['中港精密鑄造', '台中市梧棲區', '金屬鑄造', 360, 'zhonggang-cast.com.tw', 'u3', '中區', '04'],
    ['嘉禾國民小學', '嘉義市東區', '學校', 60, 'jiahe-es.com.tw', 'u6', '南區', '05'],
    ['聯晟汽車零件', '彰化縣鹿港鎮', '汽車零件', 780, 'liansheng-auto.com.tw', 'u3', '中區', '04'],
    ['花東海洋度假村', '台東縣卑南鄉', '飯店', 190, 'huadong-ocean.com.tw', 'u6', '東區', '089'],
    ['永康烘焙坊連鎖', '台南市永康區', '餐飲連鎖', 260, 'yongkang-bakery.com.tw', 'u5', '南區', '06'],
    ['新營紙業', '台南市新營區', '造紙', 330, 'xinying-paper.com.tw', 'u6', '南區', '06'],
    ['天成藥品物流', '桃園市大園區', '物流倉儲', 150, 'tiancheng-pharmalog.com.tw', 'u1', '北區', '03'],
    ['松濤長照中心', '新北市新店區', '長照', 110, 'songtao-care.com.tw', 'u2', '北區', '02'],
    ['麗水精品百貨', '台中市西區', '零售', 420, 'lishui-dept.com.tw', 'u4', '中區', '04'],
    ['寶島啤酒釀造', '宜蘭縣員山鄉', '飲料製造', 180, 'formosa-brewing.com.tw', 'u1', '北區', '03'],
    ['岡山螺絲工業', '高雄市岡山區', '扣件', 240, 'gangshan-fastener.com.tw', 'u5', '南區', '07'],
    ['雲林綠能', '雲林縣麥寮鄉', '能源', 130, 'yunlin-greenpower.com.tw', 'u4', '中區', '05'],
    ['大同高中', '台北市中山區', '學校', 150, 'datong-hs.com.tw', 'u1', '北區', '02'],
    ['科園智慧廠辦', '新竹市東區', '商辦管理', 90, 'keyuan-smartpark.com.tw', 'u2', '北區', '03'],
    ['嘉南醫學中心', '台南市永康區', '醫療', 2400, 'jianan-medical.com.tw', 'u5', '南區', '06'],
    ['宏昇金屬表面處理', '桃園市蘆竹區', '金屬加工', 170, 'hongsheng-finish.com.tw', 'u1', '北區', '03'],
    ['屏東畜產加工', '屏東縣長治鄉', '食品製造', 280, 'pingtung-meat.com.tw', 'u6', '南區', '08'],
    ['霧峰茶業', '台中市霧峰區', '農產加工', 45, 'wufeng-tea.com.tw', 'u3', '中區', '04'],
  ];

  const GROUP_OF = {
    工具機: 'factory', 食品製造: 'factory', 半導體封測: 'factory', 紡織: 'factory', 生技製藥: 'factory',
    家具製造: 'factory', 塑膠射出: 'factory', 光電: 'factory', 金屬鑄造: 'factory', 汽車零件: 'factory',
    造紙: 'factory', 飲料製造: 'factory', 扣件: 'factory', 金屬加工: 'factory', 能源: 'factory', 農產加工: 'cold',
    飯店: 'hotel', 醫療: 'medical', 長照: 'care', 學校: 'school', 物流倉儲: 'cold', 餐飲連鎖: 'cold',
    商辦管理: 'building', 資料中心: 'building', 零售: 'building', 營建: 'building',
  };

  // 報價品項組合：[sku, 金額占比]
  const BUNDLES = {
    factory: [['VB-3', 0.44], ['EM-2', 0.18], ['GW-1', 0.08], ['SV-P', 0.08], ['CL-Y', 0.22]],
    hotel: [['AQ-7', 0.5], ['GW-1', 0.06], ['SV-P', 0.1], ['CL-Y', 0.34]],
    medical: [['AQ-7', 0.42], ['CT-4', 0.16], ['GW-1', 0.07], ['SV-P', 0.1], ['CL-Y', 0.25]],
    care: [['AQ-7', 0.55], ['GW-1', 0.07], ['SV-P', 0.1], ['CL-Y', 0.28]],
    school: [['AQ-7', 0.56], ['GW-1', 0.06], ['SV-P', 0.1], ['CL-Y', 0.28]],
    cold: [['CT-4', 0.46], ['GW-1', 0.14], ['SV-P', 0.1], ['CL-Y', 0.3]],
    building: [['AQ-7', 0.3], ['EM-2', 0.3], ['GW-1', 0.08], ['SV-P', 0.08], ['CL-Y', 0.24]],
  };

  const DEAL_NAMES = {
    factory: ['三號廠房振動監測', '沖壓線預知保養', '全廠用電監控', '空壓機群能耗改善', '二廠馬達聯網', '產線設備健康監測'],
    hotel: ['客房空品監測', '宴會廳新風改善', '全館能源管理', '會議樓層空品'],
    medical: ['病房空品監測', '藥庫與血庫冷鏈', '門診大樓空品', '手術室環境監控'],
    care: ['住民房空品監測', '護理站環境監控'],
    school: ['教室 CO₂ 監測', '圖書館空品改善', '宿舍用電分表'],
    cold: ['冷藏倉溫度記錄', '冷凍車隊溫控', '低溫理貨區監測', '門市冷藏櫃聯網'],
    building: ['辦公樓層空品', '租戶分表計費', '機房電力監控', '公共區域能源管理'],
  };

  const TITLES = {
    factory: { top: ['總經理', '廠長', '副總經理'], mid: ['廠務部經理', '工務部經理', '生產部經理', '財務長', '資訊室主任'], low: ['設備課長', '保養課長', '採購專員', '廠務工程師', '生管課長', '品保課長'] },
    hotel: { top: ['總經理', '駐店經理'], mid: ['工程部經理', '房務部經理', '財務經理'], low: ['採購主任', '工程部主任', '資訊專員'] },
    medical: { top: ['副院長', '院長室特助'], mid: ['總務室主任', '護理部督導', '資訊室主任'], low: ['工務課長', '感染管制師', '採購組長', '藥劑科組長'] },
    care: { top: ['主任'], mid: ['護理長', '行政組長'], low: ['總務專員', '照服組長'] },
    school: { top: ['校長', '總務長'], mid: ['總務主任', '學務主任'], low: ['事務組長', '環安衛組長', '資訊組長'] },
    cold: { top: ['營運長', '總經理'], mid: ['倉儲部經理', '品保部經理', '資訊經理'], low: ['冷鏈課長', '採購專員', '車隊主管'] },
    building: { top: ['總經理', '營運協理'], mid: ['物業經理', '機電部經理', '工務經理'], low: ['機電主管', '總務專員', '採購副理', '維運工程師'] },
  };

  const SURNAMES = [
    ['陳', 'chen', 9], ['林', 'lin', 7], ['黃', 'huang', 5], ['張', 'chang', 5], ['王', 'wang', 4], ['吳', 'wu', 4],
    ['劉', 'liu', 4], ['楊', 'yang', 3], ['許', 'hsu', 3], ['鄭', 'cheng', 3], ['洪', 'hung', 2], ['曾', 'tseng', 2],
    ['邱', 'chiu', 2], ['廖', 'liao', 2], ['賴', 'lai', 2], ['徐', 'hsu', 2], ['蘇', 'su', 2], ['葉', 'yeh', 2],
    ['莊', 'chuang', 2], ['呂', 'lu', 2], ['江', 'chiang', 2], ['何', 'ho', 1], ['蕭', 'hsiao', 1], ['羅', 'lo', 1],
    ['高', 'kao', 1], ['潘', 'pan', 1], ['簡', 'chien', 1], ['朱', 'chu', 1], ['鍾', 'chung', 1], ['彭', 'peng', 1],
    ['游', 'yu', 1], ['詹', 'chan', 1], ['胡', 'hu', 1], ['施', 'shih', 1], ['沈', 'shen', 1], ['趙', 'chao', 1],
    ['梁', 'liang', 1], ['顏', 'yen', 1], ['柯', 'ko', 1], ['翁', 'weng', 1], ['范', 'fan', 1], ['方', 'fang', 1],
  ];
  const GIVEN = [
    ['怡君', 'yichun'], ['雅婷', 'yating'], ['淑芬', 'shufen'], ['佳蓉', 'chiajung'], ['雅雯', 'yawen'], ['欣怡', 'hsinyi'],
    ['靜宜', 'chingyi'], ['美玲', 'meiling'], ['郁婷', 'yuting'], ['佩珊', 'peishan'], ['宜蓁', 'yichen'], ['婉婷', 'wanting'],
    ['惠雯', 'huiwen'], ['詩涵', 'shihhan'], ['筱涵', 'hsiaohan'], ['思妤', 'szuyu'], ['玉珍', 'yuchen'], ['麗華', 'lihua'],
    ['秀琴', 'hsiuchin'], ['佩君', 'peichun'], ['雅惠', 'yahui'], ['家瑜', 'chiayu'], ['品萱', 'pinhsuan'], ['淑惠', 'shuhui'],
    ['志明', 'chihming'], ['建宏', 'chienhung'], ['俊傑', 'chunchieh'], ['家豪', 'chiahao'], ['冠宇', 'kuanyu'], ['宗翰', 'tsunghan'],
    ['承恩', 'chengen'], ['柏翰', 'pohan'], ['信宏', 'hsinhung'], ['文彬', 'wenpin'], ['國華', 'kuohua'], ['振宇', 'chenyu'],
    ['明哲', 'mingche'], ['彥廷', 'yenting'], ['正雄', 'chenghsiung'], ['嘉偉', 'chiawei'], ['耀德', 'yaote'], ['俊宏', 'chunhung'],
    ['世昌', 'shihchang'], ['智凱', 'chihkai'], ['志豪', 'chihhao'], ['裕仁', 'yujen'], ['銘傑', 'mingchieh'], ['啟銘', 'chiming'],
    ['立群', 'lichun'], ['永福', 'yungfu'], ['慶祥', 'chinghsiang'], ['育誠', 'yucheng'], ['泓毅', 'hungyi'], ['哲瑋', 'chewei'],
    ['建志', 'chienchih'], ['秋月', 'chiuyueh'], ['美惠', 'meihui'], ['金龍', 'chinlung'], ['文雄', 'wenhsiung'], ['素貞', 'suchen'],
  ];

  const EQUIP = {
    工具機: 'CNC 主軸馬達', 食品製造: '攪拌機馬達', 半導體封測: '真空泵浦', 紡織: '織機馬達', 生技製藥: '純水系統泵浦',
    家具製造: '裁板機馬達', 塑膠射出: '射出機油壓馬達', 光電: '冰水主機泵浦', 金屬鑄造: '熔爐鼓風機', 汽車零件: '沖床馬達',
    造紙: '烘缸驅動馬達', 飲料製造: '灌裝線馬達', 扣件: '打頭機馬達', 金屬加工: '電鍍槽循環泵浦', 能源: '冷卻水泵浦',
  };
  const ROOMS = {
    factory: ['廠長室', '三樓會議室', '工務課', '一樓接待室'], hotel: ['行政樓層會議室', '工程部辦公室', '大廳咖啡座'],
    medical: ['行政大樓會議室', '總務室', '護理部辦公室'], care: ['會客室', '行政辦公室'], school: ['總務處', '校長室', '行政大樓會議室'],
    cold: ['營運中心會議室', '倉儲辦公室'], building: ['管委會辦公室', '物業中心', '第二會議室'],
  };

  const GROUP_TEXT = {
    factory: {
      topic: ['設備預知保養', '廠區用電管理', '馬達振動監測'],
      need: ['{n} 台{equip}與空壓機的振動與電力監測', '{n} 台{equip}的預知保養，希望減少突發停機', '全廠用電分區計量，配合 ISO 50001'],
      site: ['三號廠房', '二廠', '一廠產線', '新廠區'],
      survey: ['場勘{site}，{n} 台{equip}需加裝 VB-3，配電盤空間足夠', '場勘空壓機房，{n} 台空壓機可裝 EM-2，需另拉 4G 閘道', '場勘{site}，{n} 台{equip}的軸承座可直接磁吸安裝 VB-3'],
      finding: ['PoC 兩週數據：{m} 號{equip}振動值在夜班明顯偏高', 'PoC 發現空壓機群待機耗電占全廠 12%', 'VB-3 提前 9 天偵測到 {m} 號{equip}軸承異常', 'PoC 數據顯示離峰時段仍有 {m} 台馬達空轉'],
      legacy: ['SCADA 系統', 'MES 系統', '產線 PLC'],
    },
    hotel: {
      topic: ['客房空品', '全館能源管理'],
      need: ['{n} 間客房與宴會廳的 CO₂ 監測，要能在房控系統看到', '宴會廳與會議室的新風調控，旺季前要完成'],
      site: ['客房樓層', '宴會廳', '會議樓層'],
      survey: ['場勘客房樓層，{n} 間客房需加裝 AQ-7，走廊有既有網路可用', '場勘宴會廳，新風口旁可裝 {n} 台 AQ-7，施工需避開週末婚宴'],
      finding: ['PoC 兩週數據：宴會廳活動時 CO₂ 常超過 1,200 ppm', 'PoC 發現 {m} 樓客房夜間濕度偏高，易有霉味客訴'],
      legacy: ['房控系統', '大樓 BMS'],
    },
    medical: {
      topic: ['病房空品與藥品冷鏈', '門診空品監測'],
      need: ['{n} 間病房與護理站的空品監測，另含藥庫溫度記錄', '門診大樓候診區 CO₂ 監測，配合感控稽核'],
      site: ['七樓病房', '門診大樓', '藥庫'],
      survey: ['場勘七樓病房，{n} 間病房與護理站需加裝 AQ-7，需配合院感規範施工', '場勘藥庫與血庫，{n} 個冷藏櫃需加裝 CT-4'],
      finding: ['PoC 兩週數據：候診區下午 CO₂ 平均 1,350 ppm', 'PoC 顯示藥庫溫度記錄可直接匯出給稽核，護理部很滿意'],
      legacy: ['院內 HIS', '既有溫度記錄紙本'],
    },
    care: {
      topic: ['住民房空品'],
      need: ['{n} 間住民房的 CO₂ 與溫濕度監測，夜間異常要通知護理站'],
      site: ['住民房', '護理站'],
      survey: ['場勘住民房，{n} 間房需加裝 AQ-7，護理站可放顯示看板'],
      finding: ['PoC 兩週數據：夜間門窗緊閉時 CO₂ 常超過 1,500 ppm'],
      legacy: ['叫人鈴系統'],
    },
    school: {
      topic: ['教室空品', '校園用電管理'],
      need: ['{n} 間教室的 CO₂ 監測，配合班班有冷氣後的換氣問題', '宿舍與圖書館用電分表'],
      site: ['A 棟教室', '圖書館', '學生宿舍'],
      survey: ['場勘 A 棟教室，{n} 間教室，冷氣改善工程同步進行', '場勘圖書館，閱覽區可裝 {n} 台 AQ-7'],
      finding: ['PoC 兩週數據：三樓教室午後 CO₂ 平均 1,450 ppm，開窗後降到 700', 'PoC 發現圖書館自習區晚間 CO₂ 偏高'],
      legacy: ['校園網路', '既有電表'],
    },
    cold: {
      topic: ['冷鏈溫度記錄', '倉儲溫控'],
      need: ['{n} 個冷藏儲位與冷凍車的溫度記錄，要符合 GDP 稽核', '低溫理貨區溫度監測，異常要即時通知值班'],
      site: ['冷藏倉', '冷凍庫', '低溫理貨區'],
      survey: ['場勘冷藏倉，{n} 個儲位需加裝 CT-4，冷凍庫內訊號需加閘道', '場勘冷凍車隊，{n} 台車可裝 CT-4 配 4G 閘道'],
      finding: ['PoC 發現冷藏車卸貨時溫度會短暫升到 11°C', 'PoC 兩週數據：冷凍庫門邊溫差達 4°C，建議加裝感測點'],
      legacy: ['WMS', '紙本溫度紀錄'],
    },
    building: {
      topic: ['樓宇能源管理', '辦公空品'],
      need: ['{n} 個租戶的分表計費與公共區用電監測', '辦公樓層 CO₂ 監測，要放在租戶 App 顯示'],
      site: ['B 棟', '機房', '辦公樓層'],
      survey: ['場勘 B 棟配電室，{n} 個租戶電盤可裝 EM-2', '場勘辦公樓層，{n} 個點位可裝 AQ-7，天花板有既有線槽'],
      finding: ['PoC 兩週數據：B 棟會議室下午 CO₂ 常超過 1,200 ppm', 'PoC 發現公共區照明夜間用電占 18%'],
      legacy: ['大樓 BMS', '既有電表'],
    },
  };

  const COMMON_TEXT = {
    callLead: ['初次聯繫，對方有在評估{topic}，約下週寄簡介', '展會後追蹤，{title}對 {sku} 有興趣，想先看同業案例', '轉介來電，想了解{topic}的導入費用與時程'],
    callQual: ['確認需求：{need}', '和{title}確認預算來源，今年度有編列設備汰換預算', '對方想知道能否串接{legacy}，已請技術同仁回覆'],
    callPoc: ['追蹤 PoC 安裝狀況，{n} 台已上線，數據回傳正常', '{finding}', '對方問 PoC 結束後設備能否直接轉正式採購'],
    callProp: ['報價已寄出，對方問 {sku} 能否分兩期採購', '採購說報價要附三家比價，已提供規格說明', '確認報價內容，{title}希望平台年約改成三年約'],
    callNego: ['對方要求比照去年報價打九五折，已回報主管', '採購說預算要等 {month} 月董事會', '議價：可接受九七折，但安裝要在 {month} 月前完成', '對方希望保固從一年延長到兩年'],
    callWon: ['確認交貨時程與付款條件（驗收後 60 天）', '合約用印完成，排定 {month} 月上旬安裝'],
    callLost: ['對方決定延後，今年不會動這筆預算', '得知選了既有系統商擴充，價格差約一成'],
    callFollow: ['例行關心，對方下半年沒有新場域計畫', '詢問設備使用狀況，反映平台報表很好用', '對方提到明年可能擴建新廠，約明年初再聊'],
    note: ['{title}是實際決策者，採購只負責比價', '對方 IT 對雲端有顧慮，下次帶資安白皮書', '競品也在接觸，報價約低 8%', '場域 24 小時輪班，安裝要排週末', '對方希望先從一個場域試行'],
    negoChange: ['平台年約改三年約，單價降 6%', '閘道器數量減為 {m} 台，安裝費不變', '付款條件改為驗收後 45 天'],
  };

  /* ── generate ─────────────────────────────────────── */
  function generate(now = new Date()) {
    const R = U.rng(155);
    const T = U.today();
    const q = U.quarterOf(T);
    const nowMs = now.getTime();
    const day = (n) => U.addDays(T, n);
    const isoDay = (n) => U.iso(day(n));
    const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
    /** 某天的工作時刻，保證不晚於現在 */
    function at(dayOffset, h0 = 9, h1 = 18) {
      let d = day(dayOffset);
      d.setHours(R.int(h0, h1 - 1), R.pick([0, 10, 15, 20, 30, 40, 45, 50]));
      if (d.getTime() > nowMs) {
        d = day(Math.min(dayOffset, 0) - 1);
        d.setHours(R.int(h0, h1 - 1), R.pick([0, 15, 30, 45]));
      }
      return U.isoDT(d);
    }
    const product = (sku) => PRODUCTS.find((p) => p.sku === sku);

    /* reps */
    const reps = REPS.map((r) => ({ ...r, surname: r.name[0] }));

    /* companies */
    const companies = COMPANY_DEFS.map((d, i) => {
      const [name, city, industry, size, domain, owner, region, area] = d;
      const tail = String(R.int(1000, 9999));
      return {
        id: 'o' + String(i + 1).padStart(2, '0'),
        name,
        short: name.slice(0, 2),
        city,
        region,
        industry,
        group: GROUP_OF[industry] || 'building',
        size,
        taxId: String(R.int(2, 9)) + String(R.int(1000000, 9999999)),
        domain,
        phone: `${area}-${area.length === 2 ? R.int(2200, 2899) : R.int(220, 399)}-${tail}`,
        owner,
        status: '潛在',
        createdAt: isoDay(-R.int(200, 900)),
        history: [],
      };
    });

    /* 公司最後往來天數（決定關係溫度），負責公司數平均，偶數索引較熱 */
    const QUIET = {};
    companies.forEach((c, i) => {
      const lvl = R.weighted([['hot', 42], ['warm', 26], ['cool', 18], ['cold', 14]]);
      QUIET[c.id] = { hot: R.int(0, 6), warm: R.int(8, 20), cool: R.int(23, 44), cold: R.int(50, 110) }[lvl];
    });

    /* contacts */
    const usedNames = new Set(reps.map((r) => r.name));
    const surnamePairs = SURNAMES.map((s) => [s, s[2]]);
    function personName() {
      for (let k = 0; k < 200; k++) {
        const s = R.weighted(surnamePairs);
        const g = R.pick(GIVEN);
        const n = s[0] + g[0];
        if (!usedNames.has(n)) { usedNames.add(n); return { name: n, surname: s[0], email: `${g[1]}.${s[1]}` }; }
      }
      throw new Error('name pool exhausted');
    }
    const contacts = [];
    const usedEmails = new Set();
    companies.forEach((co) => {
      const n = co.size >= 1000 ? R.int(5, 6) : co.size >= 300 ? 4 : co.size >= 100 ? R.int(3, 4) : R.int(2, 3);
      const titles = TITLES[co.group];
      const members = [];
      for (let i = 0; i < n; i++) {
        const level = i === 0 ? 'top' : i <= (n >= 4 ? 2 : 1) ? 'mid' : 'low';
        let title = R.pick(titles[level]);
        let guard = 0;
        while (members.some((m) => m.title === title) && guard++ < 10) title = R.pick(titles[level]);
        const p = personName();
        let email = `${p.email}@${co.domain}`;
        if (usedEmails.has(email)) email = `${p.email}${R.int(2, 9)}@${co.domain}`;
        usedEmails.add(email);
        const boss = level === 'top' ? null : level === 'mid' ? members[0] : R.pick(members.filter((m) => m.level === 'mid')) || members[0];
        const tags = [];
        if (level === 'top' || (level === 'mid' && /經理|主任|長$/.test(title) && R.chance(0.35))) tags.push('決策者');
        if (/工務|設備|資訊|機電|維運|廠務|保養|工程/.test(title)) tags.push('技術窗口');
        if (/採購/.test(title)) tags.push('採購');
        if (/財務/.test(title)) tags.push('財務');
        if (R.chance(0.16)) tags.push('2026 自動化展');
        const c = {
          id: 'c' + String(contacts.length + 1).padStart(3, '0'),
          name: p.name,
          surname: p.surname,
          companyId: co.id,
          title,
          level,
          email,
          mobile: `09${R.int(10, 88)}-${R.int(100, 999)}-${R.int(100, 999)}`,
          phone: `${co.phone} 分機 ${R.int(100, 899)}`,
          owner: co.owner,
          lifecycle: '潛在',
          tags,
          reportsTo: boss ? boss.id : null,
          createdAt: U.iso(U.addDays(U.parse(co.createdAt), R.int(0, 120))),
        };
        members.push(c);
        contacts.push(c);
      }
    });
    const contactsOf = (coId) => contacts.filter((c) => c.companyId === coId);

    /* deals */
    const deals = [];
    let codeN = 318;
    function buildItems(group, target) {
      const items = [];
      for (const [sku, share] of BUNDLES[group]) {
        const p = product(sku);
        const qty = Math.max(1, Math.round((target * share) / p.price));
        items.push({ sku, qty, price: p.price });
      }
      return items;
    }
    const itemsTotal = (items) => items.reduce((s, it) => s + it.qty * it.price, 0);
    function pickCompany(owner, prefer) {
      const pool = companies.filter((c) => c.owner === owner);
      const ranked = prefer ? pool.filter(prefer) : pool;
      return R.pick(ranked.length ? ranked : pool);
    }
    const dealNameUsed = new Set();
    function dealName(co) {
      const pool = DEAL_NAMES[co.group];
      for (let k = 0; k < 8; k++) {
        const n = R.pick(pool);
        if (!dealNameUsed.has(co.id + n)) { dealNameUsed.add(co.id + n); return n; }
      }
      return R.pick(pool) + '二期';
    }
    const ORDER = ['lead', 'qual', 'poc', 'prop', 'nego'];
    /** 依建立日與結束日排出每個階段的進入日期 */
    function stageHistory(start, end, finalStage) {
      const idx = finalStage === 'won' || finalStage === 'lost' ? 4 : ORDER.indexOf(finalStage);
      const path = ORDER.slice(0, idx + 1).filter((s, i) => i === 0 || i === idx || !(s === 'poc' && R.chance(0.15)));
      const span = Math.max(1, U.daysBetween(start, end));
      const hist = path.map((s, i) => ({ stage: s, at: U.iso(U.addDays(start, i === 0 ? 0 : Math.round((span * i) / path.length))) }));
      if (finalStage === 'won' || finalStage === 'lost') {
        if (finalStage === 'lost') hist.splice(R.int(2, hist.length), 99);
        hist.push({ stage: finalStage, at: U.iso(end) });
      }
      return hist;
    }
    function addDeal({ co, owner, stage, target, created, closedAt, closeDate, lostReason, histEnd }) {
      const items = buildItems(co.group, target);
      const history = stageHistory(U.parse(created), U.parse(closedAt || histEnd || isoDay(0)), stage);
      const cs = contactsOf(co.id);
      const primary = cs.find((c) => c.level !== 'top') || cs[0];
      const contactIds = [primary.id];
      const top = cs.find((c) => c.level === 'top');
      if (top && top.id !== primary.id && R.chance(0.7)) contactIds.push(top.id);
      const d = {
        id: 'd' + String(deals.length + 1).padStart(2, '0'),
        code: `Q-${U.parse(created).getFullYear()}-${String(codeN++).padStart(4, '0')}`,
        name: dealName(co),
        companyId: co.id,
        contactIds,
        owner: owner || co.owner,
        stage,
        items,
        amount: itemsTotal(items),
        closeDate: closeDate || U.iso(U.parse(closedAt)),
        createdAt: created,
        closedAt: closedAt || null,
        history,
        lostReason: lostReason || null,
        next: '',
      };
      deals.push(d);
      return d;
    }

    // 本季成交：每位業務的單（萬），合計約 2,710 萬（目標 4,500 萬的 60%）
    const WON_PLAN = { u1: [320, 210, 110], u2: [240, 140], u3: [380, 140], u4: [230, 120], u5: [300, 220], u6: [190, 110] };
    const qElapsed = Math.max(1, U.daysBetween(q.start, T));
    const usedWonCo = new Set();
    for (const [owner, plan] of Object.entries(WON_PLAN)) {
      plan.forEach((wan, i) => {
        const co = pickCompany(owner, (c) => !usedWonCo.has(c.id) && QUIET[c.id] < 30 && c.size >= (wan > 200 ? 150 : 0));
        usedWonCo.add(co.id);
        const closedOff = -Math.min(qElapsed, R.int(1, Math.max(1, qElapsed)));
        const cycle = R.int(48, 118);
        addDeal({ co, owner, stage: 'won', target: wan * 1e4 * R.float(0.97, 1.03), created: isoDay(closedOff - cycle), closedAt: isoDay(closedOff) });
        if (QUIET[co.id] > -closedOff) QUIET[co.id] = Math.max(0, -closedOff - R.int(0, 3));
      });
    }
    // 讓本季成交總額落在 55%–65%：微調最大一筆的主要品項數量
    const wonNow = () => deals.filter((d) => d.stage === 'won').reduce((s, d) => s + d.amount, 0);
    const goal = 27120000;
    {
      const big = deals.filter((d) => d.stage === 'won').sort((a, b) => b.amount - a.amount)[0];
      const main = big.items[0];
      main.qty = Math.max(1, main.qty + Math.round((goal - wonNow()) / main.price));
      big.amount = itemsTotal(big.items);
    }
    // 上季成交 2 筆
    ['u2', 'u5'].forEach((owner) => {
      const co = pickCompany(owner, (c) => !usedWonCo.has(c.id));
      usedWonCo.add(co.id);
      const closedOff = U.daysBetween(T, U.addDays(q.start, -R.int(10, 60)));
      addDeal({ co, owner, stage: 'won', target: R.int(90, 260) * 1e4, created: isoDay(closedOff - R.int(50, 100)), closedAt: isoDay(closedOff) });
    });
    // 未成 4 筆
    ['u1', 'u3', 'u4', 'u6'].forEach((owner, i) => {
      const co = pickCompany(owner, (c) => !usedWonCo.has(c.id));
      const closedOff = -R.int(8, 70);
      addDeal({ co, owner, stage: 'lost', target: R.int(40, 420) * 1e4, created: isoDay(closedOff - R.int(40, 90)), closedAt: isoDay(closedOff), lostReason: LOST_REASONS[i] });
    });
    // 進行中 45 筆
    const OPEN_PLAN = [['lead', 9, [3, 25], [55, 130]], ['qual', 10, [14, 45], [35, 100]], ['poc', 10, [25, 70], [20, 75]], ['prop', 9, [35, 90], [3, 45]], ['nego', 7, [45, 110], [-6, 20]]];
    const ownerCycle = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
    let oc = 0;
    for (const [stage, count, age, close] of OPEN_PLAN) {
      for (let i = 0; i < count; i++) {
        const owner = ownerCycle[oc++ % 6];
        const co = pickCompany(owner, (c) => deals.filter((d) => d.companyId === c.id && !d.closedAt).length < 2);
        const sz = co.size;
        const base = sz >= 1000 ? R.int(180, 680) : sz >= 300 ? R.int(90, 420) : sz >= 120 ? R.int(40, 220) : R.int(18, 90);
        const created = -R.int(age[0], age[1]);
        const closeOff = R.int(close[0], close[1]);
        // 最後一個階段的進入日落在公司最後往來之前，停留天數才合理
        const histEnd = -Math.min(-created - 2, QUIET[co.id] + R.int(1, 12));
        addDeal({ co, owner, stage, target: base * 1e4, created: isoDay(created), closeDate: isoDay(closeOff), histEnd: isoDay(histEnd) });
      }
    }
    // 金額限制在 NT$18 萬到 680 萬之間
    deals.forEach((d) => {
      while (d.amount > 6800000) { d.items[0].qty = Math.max(1, Math.floor(d.items[0].qty * 0.9)); d.amount = itemsTotal(d.items); }
      while (d.amount < 180000) { d.items[0].qty += 2; d.amount = itemsTotal(d.items); }
    });

    /* 公司狀態、聯絡人生命週期、營收歷史 */
    const qKeys = [];
    for (let k = 4; k >= 1; k--) {
      const qd = U.quarterOf(new Date(q.start.getFullYear(), q.start.getMonth() - 3 * k, 15));
      qKeys.push(qd);
    }
    const wins = [];
    companies.forEach((co) => {
      const ds = deals.filter((d) => d.companyId === co.id);
      const hasWon = ds.some((d) => d.stage === 'won');
      const hasOpen = ds.some((d) => !d.closedAt);
      const hasLost = ds.some((d) => d.stage === 'lost');
      const pastCustomer = hasWon || R.chance(0.16);
      co.status = pastCustomer ? '客戶' : hasOpen ? '洽談中' : hasLost ? '流失' : '潛在';
      if (co.status === '客戶' && !hasOpen && QUIET[co.id] > 60 && R.chance(0.5)) co.status = '流失';
      // 過去四季成交（給營收歷史與成交週期）
      co.history = qKeys.map((qd) => ({ key: qd.key, label: qd.label, amount: 0 }));
      if (pastCustomer) {
        qKeys.forEach((qd, k) => {
          // 過去每季的團隊成交約 2,300 萬到 3,000 萬，和本季同一個量級
          if (R.chance(hasWon ? 0.72 : 0.55)) {
            const amount = Math.round(R.int(45, co.size >= 500 ? 520 : 260) * 1e4 / 1000) * 1000;
            const closedAt = U.iso(U.addDays(qd.start, R.int(5, 85)));
            const cycle = R.int(45, 120);
            co.history[k].amount += amount;
            wins.push({ id: 'w' + String(wins.length + 1).padStart(2, '0'), companyId: co.id, owner: co.owner, amount, closedAt, createdAt: U.iso(U.addDays(U.parse(closedAt), -cycle)), cycleDays: cycle, quarter: qd.key });
          }
        });
      }
      const lc = { 客戶: '客戶', 洽談中: '洽談中', 潛在: '潛在', 流失: '流失' }[co.status];
      contactsOf(co.id).forEach((c) => { c.lifecycle = lc; });
    });
    // 已成交的單也列入 wins 以外的成交紀錄：由 store 從 deals 計算
    // 轉介來源與合作夥伴
    R.shuffle(contacts).slice(0, 7).forEach((c, i) => { if (!c.tags.includes('轉介來源')) c.tags.push('轉介來源'); if (i < 3) c.lifecycle = '合作夥伴'; });

    // 讓「打給陳怡君 確認報價」成立：報價階段交易的主要窗口叫陳怡君
    {
      const propDeal = deals.find((d) => d.stage === 'prop');
      const c = contacts.find((x) => x.id === propDeal.contactIds[0]);
      if (!contacts.some((x) => x.name === '陳怡君')) {
        c.name = '陳怡君';
        c.surname = '陳';
        const dom = c.email.split('@')[1];
        c.email = `yichun.chen@${dom}`;
      }
    }

    /* activities */
    const activities = [];
    const stageName = (id) => STAGES.find((s) => s.id === id).name;
    function textVars(co, deal, contact) {
      const G = GROUP_TEXT[co.group];
      const equip = EQUIP[co.industry] || '馬達';
      const rep = product(BUNDLES[co.group][0][0]);
      return {
        topic: R.pick(G.topic),
        need: fill(R.pick(G.need), { n: R.int(8, 60), equip }),
        site: R.pick(G.site),
        equip,
        legacy: R.pick(G.legacy),
        finding: fill(R.pick(G.finding), { m: R.int(2, 9), equip }),
        survey: fill(R.pick(G.survey), { n: R.int(6, 48), equip, site: R.pick(G.site) }),
        title: contact ? contact.title : '對方',
        sku: rep.sku,
        n: R.int(4, 24),
        m: R.int(2, 6),
        month: ((T.getMonth() + R.int(1, 2)) % 12) + 1,
        code: deal ? deal.code : '',
        week: R.int(1, 3),
      };
    }
    function pushActivity(a) {
      a.id = 'a' + String(activities.length + 1).padStart(4, '0');
      activities.push(a);
      return a;
    }
    function comm(type, stage, co, deal, contact, when) {
      const v = textVars(co, deal, contact);
      const base = { type, at: when, owner: deal ? deal.owner : co.owner, contactId: contact ? contact.id : null, companyId: co.id, dealId: deal ? deal.id : null };
      const key = { lead: 'Lead', qual: 'Qual', poc: 'Poc', prop: 'Prop', nego: 'Nego', won: 'Won', lost: 'Lost', follow: 'Follow' }[stage];
      if (type === 'call') {
        return pushActivity({ ...base, duration: R.pick([4, 6, 8, 12, 15, 18, 22, 25, 32]), body: fill(R.pick(COMMON_TEXT['call' + key]), v) });
      }
      if (type === 'email') {
        const EM = {
          lead: [`山嵐感測｜${v.topic}解決方案簡介`, `附上簡介與同業案例，約下週電話說明。`],
          qual: ['需求訪談紀錄與下一步', `整理訪談重點：${v.need}。建議下一步安排場勘。`],
          poc: [`PoC 週報（第 ${v.week} 週）`, `${v.finding}。完整報表見附件。`],
          prop: [`報價單 ${v.code}`, `依場勘結果提供報價，含 ${deal ? deal.items.map((i) => i.sku).join('、') : v.sku}，報價有效期 30 天。`],
          nego: [`修訂報價 ${v.code}-R${R.int(1, 3)}`, `依來電討論調整：${fill(R.pick(COMMON_TEXT.negoChange), v)}。`],
          won: ['合約與安裝排程確認', `附上合約掃描檔，安裝排定 ${v.month} 月上旬。`],
          lost: ['感謝評估', '了解貴司決定，之後有新場域需求再請聯繫。'],
          follow: ['季度使用報告', '附上本季監測摘要與異常事件統計。'],
        }[stage];
        return pushActivity({ ...base, subject: EM[0], body: EM[1] });
      }
      if (type === 'meeting') {
        const MT = {
          lead: ['初次拜訪', `介紹${v.topic}方案與同業案例`],
          qual: ['需求訪談', `確認需求：${v.need}`],
          poc: [`場勘${v.site}`, v.survey],
          prop: ['報價說明', `向${v.title}說明報價與導入時程，對方關心保固與備品`],
          nego: ['議價會議', `${fill(R.pick(COMMON_TEXT.negoChange), v)}，對方回去內部討論`],
          won: ['簽約與啟動會議', '完成簽約，雙方確認驗收標準與安裝窗口'],
          lost: ['結案訪談', '了解未成原因，對方願意明年再評估'],
          follow: ['季度回顧', '檢視監測報表，討論是否擴充到其他場域'],
        }[stage];
        const loc = R.chance(0.25) ? '視訊會議' : `${co.name.replace(/股份有限公司$/, '')} ${R.pick(ROOMS[co.group])}`;
        return pushActivity({ ...base, title: MT[0], body: MT[1], location: stage === 'poc' ? `${co.name.replace(/股份有限公司$/, '')} ${v.site}` : loc, duration: R.pick([30, 45, 60, 90, 120]) });
      }
      return pushActivity({ ...base, type: 'note', body: stage === 'poc' ? v.finding : fill(R.pick(COMMON_TEXT.note), v) });
    }

    deals.forEach((d) => {
      const co = companies.find((c) => c.id === d.companyId);
      const cs = d.contactIds.map((id) => contacts.find((c) => c.id === id));
      const start = U.parse(d.createdAt);
      const quiet = QUIET[co.id];
      const endDate = d.closedAt ? U.parse(d.closedAt) : day(-quiet);
      const windowStart = U.addDays(T, -120) > start ? U.addDays(T, -120) : start;
      // 階段變更
      d.history.forEach((h, k) => {
        if (k === 0) return;
        const off = U.daysFromToday(h.at);
        if (off < -110) return;
        pushActivity({ type: 'stage', at: at(off, 17, 19), owner: d.owner, contactId: null, companyId: co.id, dealId: d.id, from: d.history[k - 1].stage, to: h.stage, body: `${stageName(d.history[k - 1].stage)} → ${stageName(h.stage)}${h.stage === 'lost' && d.lostReason ? '：' + d.lostReason : ''}` });
      });
      // 往來
      let cur = U.addDays(windowStart, R.int(0, 3));
      const stageAt = (date) => { let s = d.history[0].stage; for (const h of d.history) if (U.parse(h.at) <= date) s = h.stage; return s; };
      while (cur < endDate) {
        const s = stageAt(cur);
        const type = R.weighted([['call', 40], ['email', 28], ['meeting', s === 'poc' ? 26 : 13], ['note', 12]]);
        const who = R.chance(0.72) ? cs[0] : R.pick(cs);
        comm(type, s, co, d, who, at(U.daysFromToday(cur)));
        cur = U.addDays(cur, R.int(14, 25));
      }
      // 最後一次往來剛好在 endDate，讓關係溫度可預期
      if (!d.closedAt || U.daysFromToday(endDate) > -120) {
        const s = d.closedAt ? d.stage : stageAt(endDate);
        comm(R.weighted([['call', 55], ['email', 30], ['meeting', 15]]), s, co, d, cs[0], at(U.daysFromToday(endDate)));
      }
    });
    // 沒有交易的公司與其他聯絡人：零星往來
    companies.forEach((co) => {
      const quiet = QUIET[co.id];
      const cs = contactsOf(co.id);
      const hasDeal = deals.some((d) => d.companyId === co.id);
      const n = hasDeal ? R.int(0, 2) : R.int(1, 4);
      for (let i = 0; i < n; i++) {
        const off = -quiet - (i === 0 && !hasDeal ? 0 : R.int(3, 60));
        comm(R.weighted([['call', 50], ['email', 30], ['meeting', 20]]), co.status === '客戶' ? 'follow' : 'lead', co, null, R.pick(cs), at(off));
      }
    });

    /* tasks */
    const tasks = [];
    const TASK_TEXT = {
      lead: ['打給{name} 約場勘時間', '寄同業案例給{name}', '確認{company}的決策流程'],
      qual: ['整理需求訪談紀錄', '確認{company}預算時程', '約{name}安排場勘'],
      poc: ['回收 PoC 數據並整理報告', '安排 PoC 結果說明會', '打給{name} 確認 PoC 感測器位置'],
      prop: ['打給{name} 確認報價', '準備三家比價資料', '寄出修訂報價給{name}'],
      nego: ['回覆議價條件給{name}', '跟主管確認折扣空間', '準備合約草稿'],
      won: ['安排安裝排程', '寄驗收文件給{name}'],
      general: ['拜訪{company}', '更新{company}組織圖', '寄季度使用報告給{name}', '追蹤{name}的展會名單', '請{name}介紹財務窗口'],
    };
    const TIMES = [null, null, null, '09:30', '10:00', '11:00', '14:00', '15:00', '16:30'];
    function addTask({ title, due, dueTime, done, doneOff, owner, contact, co, deal, priority }) {
      const t = {
        id: 't' + String(tasks.length + 1).padStart(3, '0'),
        title,
        due,
        dueTime: dueTime || null,
        priority: priority || R.weighted([['high', 20], ['normal', 60], ['low', 20]]),
        owner,
        contactId: contact ? contact.id : null,
        companyId: co ? co.id : null,
        dealId: deal ? deal.id : null,
        done: !!done,
        doneAt: done ? at(doneOff) : null,
        createdAt: U.iso(U.addDays(U.parse(due), -R.int(2, 12))),
      };
      tasks.push(t);
      return t;
    }
    // 進行中交易的下一步（逾期、今天、明天、本週、之後）
    const DUE_PLAN = R.shuffle([...Array(5).fill('overdue'), ...Array(8).fill('today'), ...Array(6).fill('tomorrow'), ...Array(9).fill('week'), ...Array(13).fill('later')]);
    const openDeals = deals.filter((d) => !d.closedAt);
    const weekLeft = Math.max(2, 6 - ((T.getDay() + 6) % 7));
    // 業務不太在週末排任務：落在週六日的偏移量挪到前後的平日（今天是週末時只留少數幾件）
    const dowOf = (off) => U.addDays(T, off).getDay();
    const workday = (off) => {
      if (off === 0 && R.chance(0.25)) return 0;
      const d = dowOf(off);
      if (d === 6) return off > 0 || off === 0 ? off + 2 : off - 1;
      if (d === 0) return off >= 0 ? off + 1 : off - 2;
      return off;
    };
    openDeals.forEach((d, i) => {
      const co = companies.find((c) => c.id === d.companyId);
      const contact = contacts.find((c) => c.id === d.contactIds[0]);
      const slot = QUIET[co.id] > 40 && R.chance(0.6) ? 'overdue' : DUE_PLAN[i % DUE_PLAN.length];
      const off = workday({ overdue: -R.int(1, 9), today: 0, tomorrow: 1, week: R.int(2, weekLeft), later: R.int(8, 30) }[slot]);
      const title = fill(R.pick(TASK_TEXT[d.stage]), { name: contact.name, company: co.name.replace(/股份有限公司$/, '') });
      const t = addTask({ title, due: isoDay(off), dueTime: R.pick(TIMES), owner: d.owner, contact, co, deal: d, priority: d.stage === 'nego' ? 'high' : undefined });
      d.next = t.title;
    });
    // 一般任務
    for (let i = 0; i < 22; i++) {
      const co = R.pick(companies);
      const contact = R.pick(contactsOf(co.id));
      const off = workday(R.weighted([[-R.int(1, 5), 1], [0, 2], [1, 2], [R.int(2, 6), 3], [R.int(7, 40), 5]]));
      addTask({ title: fill(R.pick(TASK_TEXT.general), { name: contact.name, company: co.name.replace(/股份有限公司$/, '') }), due: isoDay(off), dueTime: R.pick(TIMES), owner: i < 7 ? 'u1' : co.owner, contact, co });
    }
    // 已完成（寫入任務完成活動）
    const doneDeals = R.shuffle(deals).slice(0, 34);
    doneDeals.forEach((d) => {
      const co = companies.find((c) => c.id === d.companyId);
      const contact = contacts.find((c) => c.id === d.contactIds[0]);
      const stageForText = d.stage === 'lost' ? 'prop' : d.stage === 'won' ? 'nego' : d.stage;
      const off = -QUIET[co.id] - R.int(0, 20);
      if (d.closedAt && U.daysFromToday(d.closedAt) < off) return;
      const title = fill(R.pick(TASK_TEXT[stageForText]), { name: contact.name, company: co.name.replace(/股份有限公司$/, '') });
      const t = addTask({ title, due: isoDay(off + R.int(-1, 1)), dueTime: R.pick(TIMES), done: true, doneOff: off, owner: d.owner, contact, co, deal: d });
      pushActivity({ type: 'task', at: t.doneAt, owner: t.owner, contactId: contact.id, companyId: co.id, dealId: d.id, taskId: t.id, body: t.title });
    });

    // 近兩週的例行完成（讓本週／上週完成率有真實的量）
    const sinceMon = (T.getDay() + 6) % 7;
    for (let i = 0; i < 16; i++) {
      const thisWeek = i < 7;
      const raw = thisWeek ? -R.int(0, Math.max(0, sinceMon)) : -(sinceMon + R.int(1, 7));
      const w = workday(raw);
      const off = w > 0 ? raw : w; // 已完成的事不能落在未來
      const d = R.pick(openDeals.length ? openDeals : deals);
      const co = companies.find((c) => c.id === d.companyId);
      const contact = contacts.find((c) => c.id === d.contactIds[0]);
      const title = fill(R.pick(TASK_TEXT[d.stage] || TASK_TEXT.general), { name: contact.name, company: co.name.replace(/股份有限公司$/, '') });
      const t = addTask({ title, due: isoDay(off), dueTime: R.pick(TIMES), done: true, doneOff: off, owner: i < 4 ? 'u1' : d.owner, contact, co, deal: d });
      pushActivity({ type: 'task', at: t.doneAt, owner: t.owner, contactId: contact.id, companyId: co.id, dealId: d.id, taskId: t.id, body: t.title });
    }

    activities.sort((a, b) => (a.at < b.at ? 1 : -1));
    activities.forEach((a, i) => { a.id = 'a' + String(activities.length - i).padStart(4, '0'); });

    return {
      meta: { version: 2, seededOn: U.iso(T), quarter: q.key },
      reps,
      companies,
      contacts,
      deals,
      tasks,
      activities,
      wins,
    };
  }

  CRM.seed = { generate, PRODUCTS, STAGES, REPS, TEAM_TARGET, LIFECYCLES, COMPANY_STATUSES, TAGS, LOST_REASONS, ACTIVITY_TYPES, PRIORITIES, GROUP_OF };
})();
