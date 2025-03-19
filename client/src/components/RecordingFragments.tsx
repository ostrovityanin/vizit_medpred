import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchFragments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/recording-fragments/${recordingId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка загрузки фрагментов: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Сортируем фрагменты по индексу
      const sortedFragments = data.sort((a: Fragment, b: Fragment) => a.index - b.index);
      setFragments(sortedFragments);
    } catch (error) {
      console.error('Ошибка при загрузке фрагментов:', error);
      setError(error instanceof Error ? error.message : 'Ошибка при загрузке фрагментов');
      
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
    if (recordingId) {
      fetchFragments();
    }
  }, [recordingId]);

  // Форматирует размер в байтах в читаемый вид
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Форматирует дату для отображения
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU');
  };

  if (loading) {
    return (
      <div className="p-4 bg-neutral-50 rounded-md">
        <div className="flex items-center justify-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin text-neutral-500" />
          <span className="text-sm text-neutral-500">Загрузка фрагментов...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-md">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (fragments.length === 0) {
    return (
      <div className="p-4 bg-neutral-50 rounded-md">
        <p className="text-sm text-neutral-500">Фрагменты для этой записи не найдены</p>
      </div>
    );
  }

  return (
    <div className="border rounded-md p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Фрагменты записи ({fragments.length})</h3>
      </div>
      
      <Separator className="mb-3" />
      
      <div className="space-y-3">
        {fragments.map((fragment) => (
          <div 
            key={fragment.id}
            className="bg-neutral-50 p-2 rounded-md text-xs flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Badge 
                variant={fragment.isProcessed ? "success" : "secondary"}
                className="text-xs"
              >
                #{fragment.index}
              </Badge>
              <span className="text-neutral-600">{fragment.filename}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">{formatSize(fragment.size)}</span>
              <Badge variant="outline" className="text-xs">
                {formatDate(fragment.timestamp)}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}