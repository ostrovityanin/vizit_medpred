let device = DeviceRuntimeCore.Device;
Page({
  build() {
    console.log("building page");
    let text = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: 0,
      w: device.width,
      h: device.height,
      color: 0xffffff,
      text: "Hello Zepp",
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })
  }
})
