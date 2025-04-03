import React, { useState, useRef, ChangeEvent, FormEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const TranscriptionDemo = () => {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<string>("ru");
  const [transcriptionSpeed, setTranscriptionSpeed] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [detailedOutput, setDetailedOutput] = useState<boolean>(false);
  const [transcriptionResult, setTranscriptionResult] = useState<any>(null);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("standard");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Обработчик изменения файла
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Стандартная транскрипция
  const handleStandardTranscription = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, выберите аудиофайл",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setTranscriptionResult(null);

    try {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("language", language);
      
      if (prompt) {
        formData.append("prompt", prompt);
      }
      
      if (transcriptionSpeed) {
        formData.append("speed", transcriptionSpeed);
      }
      
      if (detailedOutput) {
        formData.append("detailed", "true");
      }

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
      }

      const result = await response.json();
      setTranscriptionResult(result);
      
      toast({
        title: "Успешно",
        description: "Транскрипция завершена",
      });
    } catch (error) {
      console.error("Ошибка при транскрипции:", error);
      toast({
        title: "Ошибка при транскрипции",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Сравнительная транскрипция
  const handleComparisonTranscription = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, выберите аудиофайл",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setComparisonResult(null);

    try {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("language", language);
      
      if (prompt) {
        formData.append("prompt", prompt);
      }

      const response = await fetch("/api/transcribe/compare", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Ошибка: ${response.status}`);
      }

      const result = await response.json();
      setComparisonResult(result);
      
      toast({
        title: "Успешно",
        description: "Сравнительная транскрипция завершена",
      });
    } catch (error) {
      console.error("Ошибка при сравнительной транскрипции:", error);
      toast({
        title: "Ошибка при сравнительной транскрипции",
        description: error instanceof Error ? error.message : "Неизвестная ошибка",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Форматирование времени
  const formatTime = (seconds: number) => {
    return `${seconds.toFixed(2)} сек`;
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Демо транскрипции аудио</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="standard">Стандартная транскрипция</TabsTrigger>
          <TabsTrigger value="comparison">Сравнение моделей</TabsTrigger>
        </TabsList>
        
        {/* Стандартная транскрипция */}
        <TabsContent value="standard">
          <Card className="p-6">
            <form onSubmit={handleStandardTranscription}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file">Аудиофайл</Label>
                  <Input
                    id="file"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="audio/*"
                    className="mt-1"
                  />
                  {file && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Выбран файл: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="language">Язык</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="language">
                      <SelectValue placeholder="Выберите язык" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ru">Русский</SelectItem>
                      <SelectItem value="en">Английский</SelectItem>
                      <SelectItem value="uk">Украинский</SelectItem>
                      <SelectItem value="zh">Китайский</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="speed">Предпочтение скорости</Label>
                  <RadioGroup 
                    value={transcriptionSpeed}
                    onValueChange={setTranscriptionSpeed}
                    className="flex space-x-4 mt-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fast" id="fast" />
                      <Label htmlFor="fast">Быстрая</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="accurate" id="accurate" />
                      <Label htmlFor="accurate">Точная</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="" id="default" />
                      <Label htmlFor="default">По умолчанию</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div>
                  <Label htmlFor="prompt">Подсказка (опционально)</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Введите подсказку для улучшения транскрипции..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Например: "Деловая встреча", "Медицинские термины" и т.д.
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="detailed"
                    checked={detailedOutput}
                    onChange={(e) => setDetailedOutput(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="detailed">Детализированный вывод с сегментами</Label>
                </div>
                
                <Button type="submit" disabled={isLoading || !file} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                      Транскрибирование...
                    </>
                  ) : (
                    "Транскрибировать"
                  )}
                </Button>
              </div>
            </form>
            
            {transcriptionResult && (
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4">Результат транскрипции</h3>
                <div className="bg-muted p-4 rounded-lg mb-4">
                  <p>{transcriptionResult.text}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p><strong>Модель:</strong> {transcriptionResult.model}</p>
                    <p><strong>Время обработки:</strong> {formatTime(transcriptionResult.processingTime)}</p>
                  </div>
                  <div>
                    <p><strong>Размер файла:</strong> {(transcriptionResult.fileSize / 1024).toFixed(2)} KB</p>
                    <p><strong>Имя файла:</strong> {transcriptionResult.fileName}</p>
                  </div>
                </div>
                
                {transcriptionResult.segments && (
                  <div className="mt-4">
                    <h4 className="text-lg font-semibold mb-2">Сегменты</h4>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>№</TableHead>
                            <TableHead>Начало</TableHead>
                            <TableHead>Конец</TableHead>
                            <TableHead>Текст</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transcriptionResult.segments.map((segment: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{segment.start.toFixed(2)}с</TableCell>
                              <TableCell>{segment.end.toFixed(2)}с</TableCell>
                              <TableCell>{segment.text}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>
        
        {/* Сравнение моделей */}
        <TabsContent value="comparison">
          <Card className="p-6">
            <form onSubmit={handleComparisonTranscription}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="comp-file">Аудиофайл</Label>
                  <Input
                    id="comp-file"
                    type="file"
                    onChange={handleFileChange}
                    accept="audio/*"
                    className="mt-1"
                  />
                  {file && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Выбран файл: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="comp-language">Язык</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="comp-language">
                      <SelectValue placeholder="Выберите язык" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ru">Русский</SelectItem>
                      <SelectItem value="en">Английский</SelectItem>
                      <SelectItem value="uk">Украинский</SelectItem>
                      <SelectItem value="zh">Китайский</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="comp-prompt">Подсказка (опционально)</Label>
                  <Textarea
                    id="comp-prompt"
                    placeholder="Введите подсказку для улучшения транскрипции..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="mt-1"
                  />
                </div>
                
                <Button type="submit" disabled={isLoading || !file} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                      Сравнение моделей...
                    </>
                  ) : (
                    "Сравнить модели"
                  )}
                </Button>
              </div>
            </form>
            
            {comparisonResult && (
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4">Результаты сравнения моделей</h3>
                
                <Table>
                  <TableCaption>Сравнение результатов разных моделей транскрипции</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Модель</TableHead>
                      <TableHead>Текст</TableHead>
                      <TableHead>Время (сек)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.keys(comparisonResult).filter(key => 
                      key !== 'fileSize' && key !== 'fileName'
                    ).map((model) => (
                      <TableRow key={model}>
                        <TableCell className="font-medium">{model}</TableCell>
                        <TableCell>
                          {comparisonResult[model].error ? 
                            <span className="text-destructive">Ошибка: {comparisonResult[model].error}</span> : 
                            comparisonResult[model].text
                          }
                        </TableCell>
                        <TableCell>
                          {comparisonResult[model].processingTime 
                            ? formatTime(comparisonResult[model].processingTime) 
                            : "-"
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                <div className="mt-4">
                  <p><strong>Размер файла:</strong> {(comparisonResult.fileSize / 1024).toFixed(2)} KB</p>
                  <p><strong>Имя файла:</strong> {comparisonResult.fileName}</p>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="mt-8 bg-muted p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Рекомендации по использованию</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Для русского текста рекомендуется использовать модель <strong>gpt-4o-mini-transcribe</strong> (быстрая) или <strong>gpt-4o-transcribe</strong> (точная)</li>
          <li>Для английского текста наилучшие результаты показывает модель <strong>whisper-1</strong></li>
          <li>Всегда указывайте корректный язык для повышения точности транскрипции</li>
          <li>Для сложного текста добавляйте подсказки, описывающие контекст или специфическую терминологию</li>
          <li>Оптимальная длительность аудиофайла - до 10 минут</li>
          <li>Детализированный вывод позволяет получить информацию о временных метках и сегментах</li>
        </ul>
      </div>
    </div>
  );
};

export default TranscriptionDemo;