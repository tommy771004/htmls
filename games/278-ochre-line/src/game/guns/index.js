// 新槍資料：一把一檔，互不改同一個檔。state.js 直接把這些物件併進 WEAPONS，所以武器欄位和 state.js 的舊武器相同。
// 其餘欄位：
//   bonus   擊殺獎金
//   stand   模型還沒進 assets/278/models/guns/ 時借用的舊槍（見 load.js）
//   support 第三人稱左手支撐點 [y, z]，槍框架，y 約等於護木下緣、z 取護木中段；soldiers.js 的 holdSupport 用 IK 把手從烘焙位置滑過來
//   desc    購買頁與軍械頁的說明
//   recoil  彈道參數 [上爬, 左右擺, 相位]，rec 要和 id 相同，見 weapons.js 的 pattern
//   shell   每發裝填秒數；有這欄就是單發裝填，途中開火會中斷（reload 只給 UI 參考）
//   vm.pose 持握：右、上、前（公尺）、偏航、俯仰（度）；vm.kick 後座：俯仰、後退、上移、右移、翻滾、彈簧 ω
//   vm.kind rifle／pistol；vm.reach 換彈時手與彈匣離開畫面的位移，沒給就是往下
//   vm.arc  換彈時手從持握換到抓彈匣途中的繞行位移，途中兩個姿勢內插手會壓扁，所以繞到畫面外；沒給就走直線
//   vm.inspect 檢視前半段的轉動倍率，袖子末端掃進畫面時調小
//   vm.slide 滑套行程（公尺），模型要有 <id>_slide 節點：開火後座、打空掛機
//   vm.tilt 換彈時整把槍的傾斜 [翻滾度, 俯仰度, 下移, 橫移]，沒給就用 viewmodel 的步槍預設
//   vm.cycle 開火後手動上膛 [開始秒, 結束秒, 翻滾度, 俯仰度, 上移, 後拉, 橫移, 偏航度, 前推]，結束要短於 60/rpm
//   vm.parts 活動零件，留在主網格、改頂點，不多 draw（viewmodel 的 buildParts）：box 槍座標（glTF）[x0,x1,y0,y1,z0,z1]，連通塊全在範圍內才算，skip 範圍排除；
//            ch 平移通道、t 位移，rc 轉動通道、r [軸, [軸上兩座標], 度]。通道 bolt（開火往復＋打空掛機＋換彈拉一次）、pull、lift（手動上膛）、cover（換彈掀蓋）
//   vm.boltT 開火往復一趟的秒數，連發要短於 60/rpm
//   port    槍口到拋殼口（公尺）；flash 第一人稱火光倍率；bigCase 大彈殼；snd 槍聲 [音量, 高頻, 低頻, 尾音秒]
import c7 from './c7.js';
import m7 from './m7.js';
import b90 from './b90.js';
import t4 from './t4.js';
import x10 from './x10.js';
import s6 from './s6.js';
import n9 from './n9.js';

export const NEW_GUNS = [c7, m7, b90, t4, x10, s6, n9];
