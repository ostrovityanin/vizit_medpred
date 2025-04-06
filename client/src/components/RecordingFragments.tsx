import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, RefreshCw } from 'lucide-react';

interface RecordingFragmentsProps {
  recordingId: number;
}

interface Fragment {
  id: number;
  recordingId: number;
  filename: string;
  index: number;
  timestamp: string;
  sessionId: string;
  size: number;
  isProcessed: boolean;
}

export default function RecordingFragments({ recordingId }: RecordingFragmentsProps) {
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Получаем фрагменты записи
  const fetchFragments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/recordings/${recordingId}/player-fragments`);
      
      if (!response.ok) {
        throw new Error('Не удалось получить фрагменты записи');
      }
      
      const data = await response.json();
      setFragments(data);
    } catch (error) {
      console.error('Error fetching fragments:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить фрагменты записи',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFragments();
  }, [recordingId]);

  // Форматирование даты из timestamp
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU');
  };

  // Форматирование размера файла
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Скачать фрагмент
  const downloadFragment = (fragmentId: number) => {
    // Путь к фрагменту
    window.open(`/api/admin/fragments/${fragmentId}/download`, '_blank');
  };

  return (
    <div className="w-full">
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-medium">
          Фрагменты записи #{recordingId}
          <span className="ml-2 text-sm text-neutral-500">
            (всего: {fragments.length})
          </span>
        </h3>
        
        <Button 
          onClick={fetchFragments}
          variant="outline"
          size="sm"
          className="text-neutral-600"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>
      
      {loading ? (
        <div className="text-center py-8">
          <p className="text-neutral-500">Загрузка фрагментов...</p>
        </div>
      ) : fragments.length === 0 ? (
        <div className="text-center py-8 bg-neutral-50 rounded">
          <p className="text-neutral-500">Фрагментов для этой записи не найдено</p>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="px-4 py-2 text-left">ID</th>
                  <th className="px-4 py-2 text-left">Индекс</th>
                  <th className="px-4 py-2 text-left">Имя файла</th>
                  <th className="px-4 py-2 text-left">Время создания</th>
                  <th className="px-4 py-2 text-left">Размер</th>
                  <th className="px-4 py-2 text-left">Сессия</th>
                  <th className="px-4 py-2 text-left">Статус</th>
                  <th className="px-4 py-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {fragments.sort((a, b) => a.index - b.index).map((fragment) => (
                  <tr key={fragment.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-2">{fragment.id}</td>
                    <td className="px-4 py-2">{fragment.index}</td>
                    <td className="px-4 py-2 font-mono text-xs truncate max-w-[200px]" title={fragment.filename}>
                      {fragment.filename}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(fragment.timestamp)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatFileSize(fragment.size)}</td>
                    <td className="px-4 py-2 font-mono text-xs truncate max-w-[150px]" title={fragment.sessionId}>
                      {fragment.sessionId}
                    </td>
                    <td className="px-4 py-2">
                      {fragment.isProcessed ? (
                        <Badge variant="success" className="whitespace-nowrap">
                          Обработан
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="whitespace-nowrap">
                          Не обработан
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        onClick={() => downloadFragment(fragment.id)}
                        variant="ghost"
                        size="sm"
                        title="Скачать фрагмент"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}