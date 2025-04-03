import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";

/**
 * Демонстрационная страница для проверки механизма уникальности комментариев
 */
export default function AffirmationDemo() {
  const [commentId, setCommentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    isProcessed: boolean;
    commentId: string;
    timestamp: string;
  } | null>(null);
  const [markResult, setMarkResult] = useState<{
    success: boolean;
    commentId: string;
    timestamp: string;
  } | null>(null);

  /**
   * Проверка, был ли комментарий обработан ранее
   */
  const checkComment = async () => {
    if (!commentId.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите ID комментария",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/affirmations/check-comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ commentId: commentId.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Ошибка при проверке комментария");
      }

      setCheckResult(data);
      toast({
        title: "Проверка выполнена",
        description: data.isProcessed
          ? `Комментарий ${data.commentId} уже был обработан`
          : `Комментарий ${data.commentId} еще не обрабатывался`,
      });
    } catch (error) {
      toast({
        title: "Ошибка при проверке",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Отметка комментария как обработанного
   */
  const markAsProcessed = async () => {
    if (!commentId.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите ID комментария",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/affirmations/mark-processed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ commentId: commentId.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Ошибка при обработке комментария");
      }

      setMarkResult(data);
      toast({
        title: "Комментарий обработан",
        description: `Комментарий ${data.commentId} отмечен как обработанный`,
      });
    } catch (error) {
      toast({
        title: "Ошибка при обработке",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Получение списка всех обработанных комментариев
   */
  const getProcessedComments = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/affirmations/processed");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Ошибка при получении списка комментариев");
      }

      toast({
        title: "Список обработанных комментариев",
        description: `Всего обработано: ${data.count} комментариев`,
      });

      // Отображение списка комментариев в виде alert-ов, но не более 10
      if (data.processed.length > 0) {
        const displayList = data.processed.slice(0, 10);
        const remainingCount = data.processed.length - displayList.length;
        
        setTimeout(() => {
          displayList.forEach((id: string, index: number) => {
            setTimeout(() => {
              toast({
                title: `Комментарий #${index + 1}`,
                description: id,
              });
            }, index * 500);
          });
          
          if (remainingCount > 0) {
            setTimeout(() => {
              toast({
                title: "И еще...",
                description: `Еще ${remainingCount} комментариев не показано`,
              });
            }, displayList.length * 500);
          }
        }, 500);
      }
    } catch (error) {
      toast({
        title: "Ошибка при получении списка",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Демо проверки уникальности комментариев</h1>
      
      <div className="grid gap-8 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Проверка обработки комментариев</CardTitle>
            <CardDescription>
              Проверьте, был ли комментарий уже обработан системой
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div className="flex space-x-2">
                <Input 
                  placeholder="Введите ID комментария" 
                  value={commentId} 
                  onChange={(e) => setCommentId(e.target.value)}
                  disabled={loading}
                />
                <Button 
                  onClick={checkComment} 
                  disabled={loading}
                  variant="outline"
                >
                  Проверить
                </Button>
              </div>
              
              {checkResult && (
                <Alert variant={checkResult.isProcessed ? "default" : "destructive"}>
                  <div className="flex items-center">
                    {checkResult.isProcessed ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />}
                    <AlertTitle>
                      {checkResult.isProcessed ? "Комментарий обработан" : "Комментарий не обработан"}
                    </AlertTitle>
                  </div>
                  <AlertDescription className="mt-2">
                    ID: {checkResult.commentId}<br />
                    Время проверки: {new Date(checkResult.timestamp).toLocaleString()}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button
              onClick={markAsProcessed}
              disabled={loading}
              variant="default"
            >
              <Send className="mr-2 h-4 w-4" />
              Отметить как обработанный
            </Button>
            
            <Button
              onClick={getProcessedComments}
              disabled={loading}
              variant="secondary"
            >
              Показать все обработанные
            </Button>
          </CardFooter>
        </Card>
        
        {markResult && (
          <Card>
            <CardHeader>
              <CardTitle>Результат обработки</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant={markResult.success ? "default" : "destructive"}>
                <div className="flex items-center">
                  {markResult.success ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />}
                  <AlertTitle>
                    {markResult.success ? "Успешно обработан" : "Ошибка обработки"}
                  </AlertTitle>
                </div>
                <AlertDescription className="mt-2">
                  ID: {markResult.commentId}<br />
                  Время обработки: {new Date(markResult.timestamp).toLocaleString()}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}