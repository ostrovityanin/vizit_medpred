const { messageBuilder } = getApp()._options.globalData;
Page({
  onInit() {
    console.log("page init");
  },
  build() {
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: 96,
      w: 480,
      h: 96,
      color: 0xffffff,
      text_size: 36,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text: "Basic Zepp App"
    });
  },
  onDestroy() {
    console.log("page destroy");
  }
})
