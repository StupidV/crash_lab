# Crash Lab｜手機網頁版 0.3

本專案把 **第一階段的真正 3D 轎車內裝與方向盤氣囊**、**第二階段的角色示意模型與參考圖片**，整合成 **可在手機瀏覽器操作的 3D 碰撞互動原型**。

## 這版可以做什麼

- 手機橫向操作（直向也可使用，但建議轉成橫向）
- 三種「前方撞擊」視覺演出：正面撞牆、左側偏撞、右側偏撞
- 撞擊車速 20–120 km/h、駕駛安全帶是否繫上、氣囊是否正常
- 後座視角／氣囊特寫／車內側面三種鏡頭
- 觸控：單指轉視角、雙指縮放；按鈕尺寸為行動裝置優化
- 撞擊測試：障礙物接近、撞擊晃動、駕駛前傾、方向盤氣囊膨脹與洩氣
- 時間軸拖曳、正常與慢動作重播、示意結果頁
- 音效開關、全螢幕功能（部分 iPhone 瀏覽器不支援）
- PWA 網頁 App 設定（需在 HTTPS 或 localhost 下使用）：首次連網開啟後，之後可離線啟動

## 電腦 + 手機，同 Wi-Fi 測試（最簡單）

1. 將 ZIP **整包解壓縮**，不要只解出 `index.html`。
2. 在 Windows 雙擊 `start_windows.bat`。它會啟動本機網站，預設連接埠 `8765`。電腦上先測試 `http://localhost:8765`。
3. 確保手機和電腦連到相同 Wi-Fi（不要讓手機開行動數據／訪客 Wi-Fi）。
4. 在 Windows PowerShell 輸入 `ipconfig`，找到 **Wi-Fi 的 IPv4 位址**（例如 `192.168.1.123`）。
5. 手機開啟 Safari 或 Chrome，輸入 `http://192.168.1.123:8765`（**換成你的實際 IP**）。
6. Windows 防火牆如有提示，允許 **私人網路** 存取 Python。
7. 有些路由器會啟用 **AP Isolation / 無線用戶端隔離**，導致手機不能連電腦；若無法連上，檢查路由器設定。

> Three.js 已內附在 `vendor/three/`（npm 套件 three@0.170.0 的原始檔，不需 CDN、不需 Node.js 或建置步驟）。區域網路測試時手機不必連外網。不能只雙擊 `index.html`，因為瀏覽器會限制 `file://` 模組與 GLB 讀取。
>
> `start_windows.bat` 需要電腦已安裝 Python（https://www.python.org/ ，安裝時勾選「Add python.exe to PATH」）。

## 希望手機在外面也能玩：發布公開網址

**建議使用 GitHub Pages 靜態網站託管。**

1. 在 GitHub 建立一個新 repository，例如 `crash-lab-mobile`。
2. 將**這份解壓縮資料夾內的所有檔案／資料夾**上傳到 repository **根目錄**。確定 `index.html` 在根目錄，`assets/`、`vendor/`、`icons/` 等子資料夾也在相同層級，並包含 `.nojekyll` 這個空檔（讓 GitHub Pages 原樣提供檔案）。注意不要只上傳 ZIP。網頁上傳時若看不到 `.nojekyll`，可在 repository 用「Add file → Create new file」建立同名空檔。
   - 網站用的是相對路徑，放在 `https://帳號.github.io/crash-lab-mobile/` 這種子路徑下也能正常運作。
   - `references/`、`preview/`、`archive/` 與 `.py` 工具不是網站執行必需，可不上傳以縮小 repository；`index.html` 載入畫面會用到 `preview/preview_no_bag.png`，建議保留 `preview/`。
3. 進入 repository 的 **Settings → Pages**，選擇 **Deploy from a branch**，Branch 選 `main`、Folder 選 `/(root)`，儲存。
4. 等 GitHub Pages 顯示網站網址後，用手機開啟該網址。GitHub Pages 的 HTTPS 也比較適合使用主畫面捷徑／安裝網頁 App。

> GitHub Pages 的實際介面可能更新。網頁未發布前不會自動出現公開網址。本專案未替你上傳或部署到任何帳戶。

## 遊戲介面

- 左上「⚙」可變更設定，**更換後請按「開始碰撞測試」**重新執行。
- 右側切換攝影機：後座、氣囊特寫、側面。
- 下方播放／暫停、重播、時間軸與速度（1×、0.5×、0.25×）。
- 上方「🔇」可開啟程式合成撞擊音效；瀏覽器通常需要先點擊才允許播放。
- 「⛶」要求全螢幕及橫向鎖定。iOS Safari 可能忽略要求，直接手動橫向即可。

## 目前的技術限制與真實性

1. 車艙及氣囊是真正的 GLB 3D 模型；駕駛是 Three.js 幾何體組裝的 **簡化替身**，不是寫實真人模型。
2. `references/` 是角色外觀與姿勢的 **PNG 參考圖片**；不能當成有骨架的 GLB 人物。已準備好換成 rigged GLB 人物的接口，步驟見 `人物模型替換說明.md`；目前尚無實際人物模型。
3. 車艙模型的座椅離方向盤太遠，遊戲載入時會把駕駛座往前移 0.22 公尺（不修改 GLB 檔）。
3. 場景的牆面相對移動，**僅為視覺演出**。目前不包含真實車體軟體變形、布料物理、人體傷害預測或碰撞力學計算。
4. 氣囊示意規則：裝置正常且設定速度至少 40 km/h 才觸發 **方向盤前氣囊**；這是遊戲規則，**不是實車觸發門檻**。不同車款氣囊觸發依撞擊減速度、方向、系統演算法等多種因素決定。
5. 左右偏撞目前共用前方氣囊動畫、加上人體側傾；側氣簾、副駕駛氣囊、後座乘客尚未建置。
6. 離線開啟需 HTTPS（或 localhost）：第一次連網開啟時，服務工作者會預先快取網站程式、Three.js 與 3D 模型，之後即可離線啟動。手機用 `http://192.168.x.x` 區域網路網址時瀏覽器不啟用服務工作者，因此不會有離線功能。iOS 可能在長時間未使用後清除快取。
7. 此版本尚未在實際 iPhone / Android 上完成可視化實測。已做靜態檢查，請以你的手機瀏覽器再驗證。

## 交給 Claude 繼續開發

從資料夾開啟 PowerShell，輸入 `claude`。Claude Code 會讀到根目錄 `CLAUDE.md`。再將 `給Claude貼上這段.txt` 內容貼到 Claude。

請保留 `assets/asset_manifest.json` 指定的氣囊位置、角色與氣囊共用時間軸、三張 GLB 模型、`references/`，不要讓 Claude 重新生成低品質替代品覆蓋已完成模型。

## 檔案簡介

| 路徑 | 用途 |
|--|--|
| `index.html` | 唯一網站入口、手機介面 |
| `game.js` | 3D 場景、動畫、遊戲邏輯與操作 |
| `driver_prototype.js` | 簡化人物 3D（目前預設的駕駛） |
| `driver_motion.js` | 駕駛共用動作：前傾、氣囊接觸、手腳 IK |
| `driver_rigged.js` | 換成 rigged GLB 人物用的接口，見 `人物模型替換說明.md` |
| `build_test_mannequin.py` | 產生測試骨架人偶 `assets/test_rig_mannequin.glb`（只用來測試，非角色模型） |
| `assets/` | 車艙、氣囊、氣囊座標資料 |
| `references/` | 同一位女性角色 5 張建模／動作參考 |
| `manifest.webmanifest`、`sw.js`、`icons/` | 主畫面圖示與 PWA 離線快取 |
| `vendor/three/` | 內附的 Three.js r170（含 OrbitControls、GLTFLoader），MIT 授權見其中 `LICENSE` |
| `.nojekyll` | 讓 GitHub Pages 原樣提供檔案 |
| `archive/` | 上一階段桌面版入口（勿作主程式） |
| `build_assets.py` | 基礎 GLB 的離線重建工具，**會覆蓋模型，平常不要執行** |
| `CLAUDE.md` | 統一的專案架構及下一步任務 |
