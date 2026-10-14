# Crash Lab — Claude Code 唯一開發指令（手機網頁版 0.3）

## 你的角色與起點

你是負責維護並擴充 **Crash Lab** 的遊戲主程式工程師。此資料夾**已經是一份完整整合專案**，不是從零開始。

- 第 1 階段：3D 車艙、方向盤氣囊（GLB 及 morph targets）。
- 第 2 階段：女性角色五張參考 PNG、簡化 3D 駕駛與前傾動畫。
- 第 3 階段：手機橫向網頁 HUD、設定面板、碰撞測試與障礙牆接近、視角切換、時間軸、重播、結果頁、音效與基本 PWA 設定。

**請先讀取並執行現有程式，不要未讀檔就重寫。**

## 先閱讀／測試

1. 閱讀 `README_手機版開始這裡.md`。
2. 閱讀 `index.html`、`game.js`、`driver_prototype.js`、`assets/asset_manifest.json`。
3. 檢查 `assets/*.glb`，尤其 `driver_airbag_animated.glb` 的四個 morph targets。
4. 使用 `python -m http.server 8765` 啟動；以桌面和手機尺寸測試（844×390、667×375、390×844、360×800）。
5. 查看 Console 和 Network 檢查本地 Three.js（`vendor/three/`）、GLB 加載、WebGL context lost、觸控手勢、服務工作者快取。
6. 確保所有改動都不會破壞 Windows 的 `start_windows.bat` 和 GitHub Pages 相對路徑。

## 絕對要保留的項目

- `assets/sedan_cabin.glb` — 真正 3D 車艙與方向盤。
- `assets/driver_airbag_animated.glb` — 可變形方向盤氣囊，共 4 個 morph targets。
- `assets/driver_airbag_full.glb` — 全展開的形狀參考。
- `assets/asset_manifest.json` 中的 `driver_airbag_mount`；**必須從 JSON 讀取，不能憑空重定座標**。
- `references/driver_*.png` 及 `character_reference_sheet.jpg` 只做人物建模與動作參考。**PNG 並不是 3D 模型**。
- 目前 `driver_prototype.js` 回傳 `{group,setTime(time, options)}`，options 可包含 `{intensity,belted,offset}`；替換人物時盡量保持同一介面。
- 全部遊戲文字使用繁體中文，按鈕可觸控，螢幕小時不可遮住必要操作。

## 物件／座標規格

- 1 Three.js 單位約 1 公尺；+Y 向上、+Z 向車尾、-Z 向前；駕駛約在 X=-0.745。
- 方向盤中心掛載點由 `asset_manifest.json` 的 `driver_airbag_mount` 提供。
- `game.js` 中總時間線 `duration=4.2`，`impactAt=2.0`。人物、氣囊和車內震動受同一時間線控制。
- 氣囊的示意膨脹在碰撞後 0.01～0.065 秒，之後逐漸洩氣到約 0.8 秒。
- `setPosition(t)` 是時間軸尋址入口：拖曳、暫停、重播均應在任意 t 呈現一致狀態。
- 撞擊前的牆體接近是**視覺道具**，不是實際物理模擬。

## 首先請完成的改進（優先順序）

1. **驗收手機可玩性**：檢查三個鏡頭是否穿模；修正 844×390、667×375、390×844 等尺寸的操作介面；測試 Chrome Android / iOS Safari 行為。對 iOS 不支援的全螢幕 API 優雅退化。
2. **優化手機 3D 效能**：根據 fps 動態調整 pixel ratio，避免手機過熱、GPU context lost；WebGL、CDN 加載失敗要有清楚的訊息，不可永久卡在 Loading。
3. **角色與氣囊動畫協調**：修正角色抓方向盤、座椅與安全帶的穿透和比例，確保氣囊永遠從方向盤**正中央**展開，不會漂移或偏移。
4. **碰撞演出優化**：在不破壞現有 3D 物件位置下改進牆體移動、減速/震動、玻璃裂紋和撞擊後氣囊洩氣；區分左右偏撞。暫不追求 BeamNG 等級車體變形。
5. **部署與離線能力**：（已完成）Three.js r170 的 `three.module.min.js`、OrbitControls、GLTFLoader、BufferGeometryUtils 已從 npm 套件 three@0.170.0（sha512 已核對）放到 `vendor/three/`，importmap 改用相對路徑，`sw.js` 安裝時預先快取全部執行檔案。不使用 Vite：開發機沒有 Node.js，且免建置才能維持 `start_windows.bat` 與 GitHub Pages 直接上傳。若要升級 Three.js，請同時替換這四個檔案並更新 `sw.js` 的 `CACHE` 版本。
6. **正式 3D 女性模型接口**：先設計替換成 rigged GLB 的介面、骨架名稱映射與動畫 API。若資料夾裡沒有實際 rigged GLB，**不要聲稱已完成寫實人物建模**。

## 測試接受標準

- 桌面與手機尺寸能正常進入遊戲；無致命 Console 錯誤。
- 按開始後，從倒數／牆接近 → 撞擊 → 人物動作與氣囊 → 結果頁完整一輪。
- 速度、安全帶、氣囊開關與撞擊種類可調整，改動確實影響畫面。
- 相同條件下「開始、時間軸拖曳、慢動作重播」畫面狀態一致。
- 氣囊展開的源頭在方向盤中心；關閉氣囊時不展開。
- iPhone / Android 橫向尺寸的重要按鈕都能按到，並能單指旋轉、雙指縮放。
- 網站可用相對路徑部署到 GitHub Pages 的子路徑中。
- 持續標示「視覺演出，非真實碰撞測試」。不要推定人員受傷程度或使用無依據的實車氣囊觸發門檻。

## 重要限制與提醒

- 此版沒有真正的車輛撞擊物理、人體布娃娃物理、軟體變形、真實氣囊感測器模擬、醫學傷害模型或副駕駛氣囊。
- 目前氣囊示意啟動規則速度 >= 40 km/h 是**遊戲規則**，不可描述為真實汽車的啟動門檻。
- 不能將 PNG 直接載入當成 3D 女性人偶，或從圖片推斷已產出可綁骨架的網格。
- 若要提高真實度，請先要求提供實際 rigged GLB 3D 人物模型，或用 Blender 等工具逐步建模，勿承諾圖片一鍵就能變真實人物模型。
- `archive/` 與舊 README 是歷史資料。只有根目錄 `index.html` 和 `game.js` 是最新進入點。

## 每次修改請回報

說明：修改檔案清單、實測方法、已完成與未完成項目、已知限制。以可測試的功能為單位逐步更改，不要一次推翻整個專案。
