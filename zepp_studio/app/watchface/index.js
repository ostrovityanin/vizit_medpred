const logger = DeviceRuntimeCore.HmLogger.getLogger("watchface");
WatchFace({
  onInit() {
    logger.log("watchface onInit");
    this.initView();
  },
  initView() {
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 96,
      y: 180,
      w: 288,
      h: 46,
      color: 0xffffff,
      text_size: 36,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE,
      text: "Basic Zepp App"
    });
  }
})
