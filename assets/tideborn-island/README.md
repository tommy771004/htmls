# 潮生島村民

`villager.gltf` 是本專案原創程序化模型，未使用外部角色素材。採 7 個骨骼的 skin，包含 `idle`、`walk`、`work` 三段 quaternion rotation 動畫；buffer 內嵌於 glTF。

重建：`python3 games/139-tideborn-island/generate-villager.py`。

執行時以 GLTFLoader 載入、SkeletonUtils.clone 建立獨立骨架，AnimationMixer 切換動畫。職業以衣物顏色區分，路徑與行為由 simulation.mjs 驅動。
