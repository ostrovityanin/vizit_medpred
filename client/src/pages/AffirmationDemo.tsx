import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

/**
 * Компонент для демонстрации работы с аффирмациями
 */
export default function AffirmationDemo() {
  const { toast } = useToast();
  const [commentId, setCommentId] = useState('');
  const [affirmationText, setAffirmationText] = useState('');
  const [recipientUsername, setRecipientUsername] = useState('');
  const [authorUsername, setAuthorUsername] = useState('');

  // Запрос на получение списка обработанных комментариев
  const { 
    data: processedComments,
    isLoading,
    isError,
    refetch: refetchProcessedComments
  } = useQuery({
    queryKey: ['processedComments'],
    queryFn: async () => {
      const { data } = await axios.get('/api/affirmations/processed');
      return data;
    }
  });

  // Мутация для отправки аффирмации
  const sendAffirmationMutation = useMutation({
    mutationFn: async (data: { 
      text: string;
      recipientUsername?: string;
      authorUsername?: string;
      messageId: string;
    }) => {
      const response = await axios.post('/api/affirmations', data);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Аффирмация отправлена",
        description: "Аффирмация успешно обработана и отправлена",
      });
      // Очищаем форму
      setAffirmationText('');
      setCommentId('');
      // Обновляем список обработанных комментариев
      refetchProcessedComments();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка отправки",
        description: error.response?.data?.error || "Произошла ошибка при отправке аффирмации",
        variant: "destructive",
      });
    }
  });

  // Мутация для проверки, обработан ли комментарий
  const checkCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await axios.post('/api/affirmations/check-comment', { commentId });
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: data.isProcessed ? "Комментарий уже обработан" : "Комментарий не обработан",
        description: data.isProcessed 
          ? `Комментарий ${data.commentId} уже был обработан ранее` 
          : `Комментарий ${data.commentId} еще не был обработан`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка проверки",
        description: error.response?.data?.error || "Произошла ошибка при проверке комментария",
        variant: "destructive",
      });
    }
  });

  // Мутация для пометки комментария как обработанного
  const markProcessedMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await axios.post('/api/affirmations/mark-processed', { commentId });
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Комментарий помечен как обработанный",
        description: `Комментарий ${data.commentId} успешно помечен как обработанный`
      });
      // Обновляем список обработанных комментариев
      refetchProcessedComments();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка обработки",
        description: error.response?.data?.error || "Произошла ошибка при пометке комментария",
        variant: "destructive",
      });
    }
  });

  // Обработчик отправки аффирмации
  const handleSendAffirmation = () => {
    if (!affirmationText) {
      toast({
        title: "Не указан текст аффирмации",
        description: "Пожалуйста, введите текст аффирмации",
        variant: "destructive",
      });
      return;
    }

    if (!commentId) {
      toast({
        title: "Не указан ID комментария",
        description: "Пожалуйста, введите ID комментария",
        variant: "destructive",
      });
      return;
    }

    // Отправляем аффирмацию
    sendAffirmationMutation.mutate({
      text: affirmationText,
      recipientUsername: recipientUsername || undefined,
      authorUsername: authorUsername || undefined,
      messageId: commentId
    });
  };

  // Обработчик проверки комментария
  const handleCheckComment = () => {
    if (!commentId) {
      toast({
        title: "Не указан ID комментария",
        description: "Пожалуйста, введите ID комментария для проверки",
        variant: "destructive",
      });
      return;
    }

    checkCommentMutation.mutate(commentId);
  };

  // Обработчик пометки комментария как обработанного
  const handleMarkProcessed = () => {
    if (!commentId) {
      toast({
        title: "Не указан ID комментария",
        description: "Пожалуйста, введите ID комментария для пометки",
        variant: "destructive",
      });
      return;
    }

    markProcessedMutation.mutate(commentId);
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Демонстрация работы с аффирмациями</h1>
      
      <Tabs defaultValue="send">
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="send">Отправка аффирмации</TabsTrigger>
          <TabsTrigger value="check">Проверка комментария</TabsTrigger>
          <TabsTrigger value="list">Список обработанных</TabsTrigger>
        </TabsList>
        
        <TabsContent value="send">
          <Card>
            <CardHeader>
              <CardTitle>Отправка аффирмации</CardTitle>
              <CardDescription>
                Заполните форму для отправки новой аффирмации
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="comment-id">ID комментария *</Label>
                <Input 
                  id="comment-id" 
                  placeholder="Введите уникальный ID комментария" 
                  value={commentId} 
                  onChange={(e) => setCommentId(e.target.value)}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="affirmation-text">Текст аффирмации *</Label>
                <Textarea 
                  id="affirmation-text" 
                  placeholder="Введите текст аффирмации" 
                  value={affirmationText} 
                  onChange={(e) => setAffirmationText(e.target.value)}
                  rows={4}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="recipient">Получатель аффирмации</Label>
                <Input 
                  id="recipient" 
                  placeholder="Имя пользователя получателя (необязательно)" 
                  value={recipientUsername} 
                  onChange={(e) => setRecipientUsername(e.target.value)}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="author">Автор аффирмации</Label>
                <Input 
                  id="author" 
                  placeholder="Имя пользователя автора (необязательно)" 
                  value={authorUsername} 
                  onChange={(e) => setAuthorUsername(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleSendAffirmation} 
                disabled={sendAffirmationMutation.isPending}
              >
                {sendAffirmationMutation.isPending ? "Отправка..." : "Отправить аффирмацию"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="check">
          <Card>
            <CardHeader>
              <CardTitle>Проверка и обработка комментария</CardTitle>
              <CardDescription>
                Проверьте, был ли комментарий уже обработан, или пометьте его как обработанный
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="check-comment-id">ID комментария *</Label>
                <Input 
                  id="check-comment-id" 
                  placeholder="Введите ID комментария для проверки" 
                  value={commentId} 
                  onChange={(e) => setCommentId(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button 
                onClick={handleCheckComment}
                disabled={checkCommentMutation.isPending}
                variant="outline"
              >
                {checkCommentMutation.isPending ? "Проверка..." : "Проверить"}
              </Button>
              <Button 
                onClick={handleMarkProcessed}
                disabled={markProcessedMutation.isPending}
              >
                {markProcessedMutation.isPending ? "Обработка..." : "Пометить как обработанный"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>Список обработанных комментариев</CardTitle>
              <CardDescription>
                Все комментарии, которые были помечены как обработанные
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>Загрузка списка обработанных комментариев...</p>
              ) : isError ? (
                <p className="text-red-500">Ошибка при загрузке списка обработанных комментариев</p>
              ) : (
                <div>
                  <p>Всего обработано комментариев: {processedComments?.count || 0}</p>
                  
                  {processedComments?.processed?.length > 0 ? (
                    <div className="mt-4 border rounded-md p-4 max-h-80 overflow-auto">
                      <ul className="list-disc list-inside">
                        {processedComments.processed.map((commentId: string) => (
                          <li key={commentId} className="py-1">{commentId}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-4">Список обработанных комментариев пуст</p>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => refetchProcessedComments()} 
                variant="outline"
              >
                Обновить список
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}