Page({
  onInit() {
    console.log("main page init");
  },
  build() {
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: 120,
      w: 480,
      h: 80,
      color: 0xffffff,
      text_size: 36,
      align_h: hmUI.align.CENTER_H,
      text: "Voice Recorder"
    });
    
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: (480 - 200) / 2,
      y: 220,
      w: 200,
      h: 80,
      text: "Start Recording",
      radius: 40,
      normal_color: 0xff0000,
      press_color: 0xaa0000,
      click_func: () => {
        console.log("Would start recording");
      }
    });
  },
  onDestroy() {
    console.log("main page destroyed");
  }
})
