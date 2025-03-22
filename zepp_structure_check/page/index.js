Page({
  build() {
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 96,
      y: 200,
      w: 288,
      h: 46,
      color: 0xffffff,
      text_size: 36,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE,
      text: "Simple Audio Recorder"
    });
    
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 120,
      y: 280, 
      w: 240,
      h: 80,
      radius: 40,
      normal_color: 0xff0000,
      press_color: 0xaa0000,
      text: "Record",
      click_func: () => {
        hmUI.showToast({text: "Recording feature would start here"})
      }
    });
  }
})
