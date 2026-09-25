# 09｜戰鬥、兵種、彈道與攻城


製作具相剋、位置、射程、科技與命令行為的 RTS 戰鬥，而非只有 attack 減 HP。

- 攻擊資料包含 damage classes、armor classes、base／bonus modifiers、attack interval、windup、range／minimum range、accuracy、projectile policy、splash／piercing、target restrictions。公式需對照 ruleset；未核對的測試公式標示 design_default。
- 近戰攻擊必須可接近合法位置；遠程命中在指定 tick 結算，投射物是權威事件或權威 entity。視覺箭矢可插值但不能在 render callback 決定傷害。
- 移動目標、命中率、彈道科技、高低差、遮擋、友軍傷害、濺射衰減、最小傷害及對建築／船隻／攻城器的特效規則，逐項以所選版本核對並測試。
- 支援近戰步兵、長柄反騎兵、弓手、反遠程單位、騎兵、騎射、攻城車／弩砲／投石類、展開型遠程攻城器、火藥單位、文明專屬單位與海軍等資料類別。具體清單來自 manifest，不固定為少數範例。
- 攻城器有移動／展開／收起／裝填／發射等狀態，並具合適最小射程、轉向與目標限制。駐軍帶來的攻擊或移動影響依資料計算。
- aggressive／defensive／stand-ground／no-attack 等姿態、attack-move、patrol、guard、retaliation、target acquisition、追擊半徑及失去目標後行為需一致。不能看到全圖敵方後自動追殺。
- 治療、回血、轉化、暫時效果與死亡分別處理。死亡同 tick 的命令、人口釋放、乘員、貨物、選取與 AI 引用不可留下 dangling references。
- 戰鬥視覺使用積木武器、盾牌、少量火花、積木解體；不加入未定義的流血、斷肢、每磚護甲或可破壞牆磚新規則。

驗收：近戰接敵、反制兵種、遠程對移動目標、科技前後傷害、不同護甲類別、友軍／中立誤傷規則、攻城展開取消、死亡與轉化競爭、視野外索敵。建立小型可重播戰鬥場景，結果需可追溯到資料與命令。
