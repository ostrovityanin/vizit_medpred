import { createElement } from 'zos-ui';
import { back } from '@zos/router';
import { showToast, showDialog } from '@zos/interaction';
import { vibrate } from '@zos/vibrator';
import { recorder } from '../utils/recorder';
import { finishRecording } from '../utils/api';
import { formatTime } from '../utils/format';

// Константы для UI
const SCREEN_WIDTH = 480;
const SCREEN_HEIGHT = 480;

const styles = {
  mainContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000000',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusText: {
    fontSize: 32,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20
  },
  timerText: {
    fontSize: 64,
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 50
  },
  buttonContainer: {
    width: SCREEN_WIDTH,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20
  },
  button: {
    width: 120,
    height: 120,
    borderRadius: 60,
    margin: 15,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  recordButton: {
    backgroundColor: '#ff4455'
  },
  stopButton: {
    backgroundColor: '#444444'
  },
  buttonIcon: {
    fontSize: 50,
    color: '#ffffff'
  },
  buttonText: {
    fontSize: 16,
    color: '#ffffff',
    marginTop: 5
  },
  fragmentInfo: {
    fontSize: 20, 
    color: '#999999',
    marginTop: 15
  },
  pulsatingCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#ff4455',
    opacity: 0.2,
    position: 'absolute'
  }
};

// Страница записи
Page({
  onInit() {
    this.isRecording = false;
    this.duration = 0;
    this.fragments = 0;
    this.sessionId = null;
    this.timer = null;
    this.pulseAnimation = null;
    
    // Настраиваем обработчик изменения статуса записи
    recorder.setStatusChangeListener(this.onRecordingStatusChange.bind(this));
  },
  
  build() {
    const mainContainer = createElement('view', {
      style: styles.mainContainer
    });
    
    // Анимированный круг (только при записи)
    if (this.isRecording) {
      const pulsatingCircle = createElement('view', {
        style: {
          ...styles.pulsatingCircle,
          animation: {
            keyframes: [
              { opacity: 0.1, transform: 'scale(0.8)' },
              { opacity: 0.2, transform: 'scale(1.1)' },
              { opacity: 0.1, transform: 'scale(0.8)' },
            ],
            duration: 2000,
            iterations: 'infinite'
          }
        }
      });
      
      mainContainer.appendChild(pulsatingCircle);
    }
    
    // Статус записи
    mainContainer.appendChild(
      createElement('text', {
        style: styles.statusText,
        text: this.isRecording ? 'Идёт запись...' : 'Готов к записи'
      })
    );
    
    // Таймер
    mainContainer.appendChild(
      createElement('text', {
        style: styles.timerText,
        text: formatTime(this.duration)
      })
    );
    
    // Информация о фрагментах (если идет запись)
    if (this.isRecording && this.fragments > 0) {
      mainContainer.appendChild(
        createElement('text', {
          style: styles.fragmentInfo,
          text: `Фрагментов: ${this.fragments}`
        })
      );
    }
    
    // Контейнер для кнопок
    const buttonContainer = createElement('view', {
      style: styles.buttonContainer
    });
    
    if (this.isRecording) {
      // Кнопка остановки
      const stopButton = createElement('view', {
        style: {
          ...styles.button,
          ...styles.stopButton
        },
        onclick: () => {
          this.stopRecording();
        }
      });
      
      stopButton.appendChild(
        createElement('text', {
          style: styles.buttonIcon,
          text: '■'
        })
      );
      
      stopButton.appendChild(
        createElement('text', {
          style: styles.buttonText,
          text: 'СТОП'
        })
      );
      
      buttonContainer.appendChild(stopButton);
    } else {
      // Кнопка записи
      const recordButton = createElement('view', {
        style: {
          ...styles.button,
          ...styles.recordButton
        },
        onclick: () => {
          this.startRecording();
        }
      });
      
      recordButton.appendChild(
        createElement('text', {
          style: styles.buttonIcon,
          text: '🎙️'
        })
      );
      
      recordButton.appendChild(
        createElement('text', {
          style: styles.buttonText,
          text: 'ЗАПИСЬ'
        })
      );
      
      buttonContainer.appendChild(recordButton);
    }
    
    mainContainer.appendChild(buttonContainer);
    
    return mainContainer;
  },
  
  // Обработчик изменения статуса записи
  onRecordingStatusChange(status) {
    this.isRecording = status.isRecording;
    this.duration = status.duration || 0;
    this.sessionId = status.sessionId;
    this.fragments = status.fragments || 0;
    
    if (!this.isRecording && status.status === 'completed') {
      // Запись завершена, показываем диалог
      this.showCompletionDialog();
    }
    
    this.onAppear(); // Обновляем UI
  },
  
  // Начать запись
  startRecording() {
    const success = recorder.startRecording();
    
    if (success) {
      this.isRecording = true;
      this.duration = 0;
      this.fragments = 0;
      
      // Запускаем таймер обновления UI каждую секунду
      this.timer = setInterval(() => {
        this.duration++;
        this.onAppear(); // Обновляем UI
      }, 1000);
      
      vibrate({ mode: 'medium' });
    } else {
      showToast({ content: 'Не удалось начать запись' });
    }
  },
  
  // Остановить запись
  async stopRecording() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    const result = await recorder.stopRecording();
    
    if (result) {
      vibrate({ mode: 'long' });
      this.isRecording = false;
      this.onAppear(); // Обновляем UI
      
      // Показываем диалог завершения
      this.showCompletionDialog();
    } else {
      showToast({ content: 'Ошибка при остановке записи' });
    }
  },
  
  // Показать диалог завершения записи
  showCompletionDialog() {
    if (!this.sessionId) return;
    
    showDialog({
      title: 'Запись завершена',
      content: `Продолжительность: ${formatTime(this.duration)}
                Количество фрагментов: ${this.fragments}
                
                Запись будет отправлена на сервер.`,
      buttons: [
        {
          text: 'ОК',
          press: async () => {
            try {
              showToast({ content: 'Отправка на сервер...' });
              
              // Отправляем сигнал завершения на сервер
              const result = await finishRecording(this.sessionId);
              
              if (result && !result.error) {
                showToast({ content: 'Запись успешно отправлена' });
              } else {
                showToast({ content: 'Ошибка при отправке' });
              }
              
              // Возвращаемся на главный экран
              setTimeout(() => {
                back();
              }, 1000);
            } catch (error) {
              console.error('Ошибка при завершении:', error);
              showToast({ content: 'Ошибка: ' + error.message });
            }
          }
        }
      ]
    });
  },
  
  onDestroy() {
    // Очистка ресурсов при уничтожении страницы
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    // Если запись все еще идет, останавливаем ее
    if (this.isRecording) {
      recorder.stopRecording('page_closed');
    }
  }
});