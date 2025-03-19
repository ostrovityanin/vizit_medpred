import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send } from 'lucide-react';
import { Link } from 'wouter';

export default function TestTelegram() {
  const [message, setMessage] = useState('Тестовое сообщение из таймера визита');
  const [username, setUsername] = useState('ostrovityanin');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSendMessage = async () => {
    try {
      setSending(true);
      
      toast({
        title: "Отправка сообщения",
        description: `Отправка сообщения на @${username}...`,
      });
      
      const response = await fetch('/api/send-telegram-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          message,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Успех",
          description: data.message,
        });
      } else {
        toast({
          title: "Ошибка",
          description: data.message || 'Не удалось отправить сообщение',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Ошибка",
        description: 'Произошла ошибка при отправке сообщения',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-8">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span>Назад</span>
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-tgblue">Тест Telegram API</h1>
      </header>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Отправка текстового сообщения</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Получатель (имя пользователя)
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ostrovityanin"
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Сообщение
            </label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Введите сообщение"
              className="w-full"
            />
          </div>
          
          <Button 
            onClick={handleSendMessage} 
            disabled={sending || !message.trim() || !username.trim()}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Отправка...' : 'Отправить'}
          </Button>
        </div>
      </div>
      
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
        <p>
          Этот инструмент позволяет протестировать отправку сообщений через Telegram бот. 
          <br/><br/>
          Для получения сообщений пользователь должен сначала найти бот @KashMenBot и 
          отправить ему команду /start. В противном случае бот не сможет отправить сообщение.
        </p>
      </div>
    </div>
  );
}