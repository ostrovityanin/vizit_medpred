import { createElement } from 'zos-ui';
import { push } from '@zos/router';
import { showToast, showDialog } from '@zos/interaction';
import { getText } from '@zos/i18n';
import { recorder } from '../utils/recorder';
import { getSessionInfo } from '../utils/api';
import { formatTime, formatDate } from '../utils/format';

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
  title: {
    color: '#ffffff',
    fontSize: 36,
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 40
  },
  button: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#ff4455',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30
  },
  buttonIcon: {
    fontSize: 60,
    color: '#ffffff'
  },
  buttonText: {
    fontSize: 20,
    color: '#ffffff',
    marginTop: 10
  },
  recentSessionsTitle: {
    fontSize: 24,
    color: '#999999',
    marginTop: 20,
    marginBottom: 10
  },
  sessionItem: {
    width: SCREEN_WIDTH - 60,
    height: 60,
    backgroundColor: '#222222',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    flexDirection: 'column'
  },
  sessionTitle: {
    color: '#ffffff',
    fontSize: 18
  },
  sessionInfo: {
    color: '#999999',
    fontSize: 14
  }
};

// Получить последние сессии записи
function getRecentSessions() {
  try {
    const sessions = [];
    const keys = hmFS.SysProGetAll();
    
    keys.filter(key => key.startsWith('session_')).forEach(key => {
      const sessionData = getSessionInfo(key.replace('session_', ''));
      if (sessionData) {
        sessions.push(sessionData);
      }
    });
    
    return sessions.sort((a, b) => b.startTime - a.startTime).slice(0, 3);
  } catch (error) {
    console.error('Ошибка получения сессий:', error);
    return [];
  }
}

Page({
  onInit() {
    this.recentSessions = getRecentSessions();
  },
  
  build() {
    const mainContainer = createElement('view', {
      style: styles.mainContainer
    });
    
    // Заголовок
    mainContainer.appendChild(
      createElement('text', {
        style: styles.title,
        text: 'Запись Аудио'
      })
    );
    
    // Кнопка записи
    const recordButton = createElement('view', {
      style: styles.button,
      onclick: () => {
        push({
          url: 'pages/recording'
        });
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
        text: 'ЗАПИСАТЬ'
      })
    );
    
    mainContainer.appendChild(recordButton);
    
    // Последние записи (если есть)
    if (this.recentSessions && this.recentSessions.length > 0) {
      mainContainer.appendChild(
        createElement('text', {
          style: styles.recentSessionsTitle,
          text: 'Последние записи'
        })
      );
      
      this.recentSessions.forEach(session => {
        const sessionItem = createElement('view', {
          style: styles.sessionItem,
          onclick: () => {
            showDialog({
              title: 'Информация о записи',
              content: `Дата: ${formatDate(session.startTime)}
                       Длительность: ${formatTime(session.totalDuration || 0)}
                       Фрагментов: ${session.fragments || 0}
                       Статус: ${session.status === 'completed' ? 'Завершена' : 'В процессе'}`,
              buttons: [
                {
                  text: 'OK',
                  press: () => {}
                }
              ]
            });
          }
        });
        
        sessionItem.appendChild(
          createElement('text', {
            style: styles.sessionTitle,
            text: formatDate(session.startTime)
          })
        );
        
        sessionItem.appendChild(
          createElement('text', {
            style: styles.sessionInfo,
            text: `${formatTime(session.totalDuration || 0)} • ${session.status === 'completed' ? 'Завершена' : 'В процессе'}`
          })
        );
        
        mainContainer.appendChild(sessionItem);
      });
    }
    
    return mainContainer;
  },
  
  onDestroy() {
    // Очистка ресурсов при уничтожении страницы
  }
});