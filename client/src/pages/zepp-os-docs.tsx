import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useEffect, useState } from "react";
import { Link } from "wouter";

export default function ZeppOSDocs() {
  const [base64Packages, setBase64Packages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBase64Files = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/zepp_all_base64.md');
        const text = await response.text();
        const packageRegex = /## (.+?\.(?:zab|deb))\n```\n([\s\S]+?)\n```/g;
        
        const packages: Record<string, string> = {};
        let match;
        while ((match = packageRegex.exec(text)) !== null) {
          packages[match[1]] = match[2];
        }
        
        setBase64Packages(packages);
      } catch (error) {
        console.error('Ошибка при загрузке файлов base64:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBase64Files();
  }, []);

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Документация по Zepp OS</h1>
          <Link href="/admin">
            <Button variant="outline">Вернуться на панель администратора</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Пакеты для установки</CardTitle>
            <CardDescription>
              Здесь вы можете скачать различные версии пакетов для Zepp OS
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <a href="/basic_zepp.zab" download className="no-underline">
                <Card className="h-full hover:bg-muted/50 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Базовый пакет</CardTitle>
                    <CardDescription>basic_zepp.zab</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">Простой базовый пакет для Zepp OS</p>
                  </CardContent>
                </Card>
              </a>
              
              <a href="/minimal_fixed_zepp.zab" download className="no-underline">
                <Card className="h-full hover:bg-muted/50 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Исправленный минимальный пакет</CardTitle>
                    <CardDescription>minimal_fixed_zepp.zab</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">Исправленная минимальная версия с правильной структурой</p>
                  </CardContent>
                </Card>
              </a>
              
              <a href="/pure_minimal_zepp.zab" download className="no-underline">
                <Card className="h-full hover:bg-muted/50 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Чистый минимальный пакет</CardTitle>
                    <CardDescription>pure_minimal_zepp.zab</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">Максимально упрощенная версия с корректным манифестом</p>
                  </CardContent>
                </Card>
              </a>
              
              <a href="/fixed_zepp_app.zab" download className="no-underline">
                <Card className="h-full hover:bg-muted/50 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Пакет с исправленной структурой</CardTitle>
                    <CardDescription>fixed_zepp_app.zab</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">Полная версия с исправленной файловой структурой</p>
                  </CardContent>
                </Card>
              </a>
              
              <a href="/pure-minimal-zepp.deb" download className="no-underline">
                <Card className="h-full hover:bg-muted/50 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Debian-пакет</CardTitle>
                    <CardDescription>pure-minimal-zepp.deb</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">Альтернативный метод установки через Debian-пакет</p>
                  </CardContent>
                </Card>
              </a>
              
              <a href="/zepp_all_packages.zip" download className="no-underline">
                <Card className="h-full hover:bg-muted/50 transition-colors bg-primary/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Все пакеты и документация</CardTitle>
                    <CardDescription>zepp_all_packages.zip</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">Архив, содержащий все пакеты и документацию</p>
                  </CardContent>
                </Card>
              </a>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="packages">
          <TabsList className="grid grid-cols-3 w-full md:w-[400px]">
            <TabsTrigger value="packages">Base64 пакеты</TabsTrigger>
            <TabsTrigger value="installation">Установка</TabsTrigger>
            <TabsTrigger value="limitations">Ограничения</TabsTrigger>
          </TabsList>
          
          <TabsContent value="packages">
            <Card>
              <CardHeader>
                <CardTitle>Пакеты в формате Base64</CardTitle>
                <CardDescription>
                  Скопируйте и декодируйте base64-строки, чтобы получить бинарные файлы пакетов
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <Accordion type="single" collapsible className="w-full">
                    {Object.entries(base64Packages).map(([filename, base64]) => (
                      <AccordionItem key={filename} value={filename}>
                        <AccordionTrigger>{filename}</AccordionTrigger>
                        <AccordionContent>
                          <div className="relative">
                            <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs max-h-[300px]">
                              {base64.length > 500 
                                ? base64.substring(0, 500) + '...' 
                                : base64}
                            </pre>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="absolute top-2 right-2"
                              onClick={() => {
                                navigator.clipboard.writeText(base64);
                                // Можно добавить тост для уведомления
                              }}
                            >
                              Копировать
                            </Button>
                          </div>
                          <div className="mt-4 text-sm">
                            <p className="font-semibold">Как использовать:</p>
                            <div className="grid grid-cols-1 gap-4 mt-2">
                              <div>
                                <p className="font-medium">Linux/Mac:</p>
                                <pre className="bg-muted p-2 rounded-md text-xs mt-1">
                                  {`echo 'BASE64_СТРОКА' | base64 -d > ${filename}`}
                                </pre>
                              </div>
                              <div>
                                <p className="font-medium">Windows (PowerShell):</p>
                                <pre className="bg-muted p-2 rounded-md text-xs mt-1">
                                  {`[System.Convert]::FromBase64String('BASE64_СТРОКА') | Set-Content -Path ${filename} -Encoding Byte`}
                                </pre>
                              </div>
                              <div>
                                <p className="font-medium">Python:</p>
                                <pre className="bg-muted p-2 rounded-md text-xs mt-1">
                                  {`import base64
with open('${filename}', 'wb') as f:
    f.write(base64.b64decode('BASE64_СТРОКА'))`}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="installation">
            <Card>
              <CardHeader>
                <CardTitle>Руководство по установке</CardTitle>
                <CardDescription>
                  Инструкции по установке приложения на устройства Zepp OS
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="mb-6">
                    <h3>Установка через Zepp OS Store</h3>
                    <ol>
                      <li>Скачайте файл .zab с этой страницы</li>
                      <li>Откройте приложение Zepp на вашем смартфоне</li>
                      <li>Перейдите в раздел "Профиль" → "Мои устройства"</li>
                      <li>Выберите ваши смарт-часы</li>
                      <li>Нажмите на "Управление приложениями"</li>
                      <li>В верхнем правом углу нажмите "+" и выберите скачанный файл .zab</li>
                      <li>Следуйте инструкциям на экране для завершения установки</li>
                    </ol>
                  </div>
                  
                  <div className="mb-6">
                    <h3>Альтернативный метод установки (Debian-пакет)</h3>
                    <ol>
                      <li>Скачайте файл .deb с этой страницы</li>
                      <li>На устройстве с Ubuntu/Debian выполните команду: <code>sudo dpkg -i pure-minimal-zepp.deb</code></li>
                      <li>Приложение будет установлено в директорию: <code>/usr/share/zepp/apps/pure-minimal-zepp</code></li>
                    </ol>
                  </div>
                  
                  <div className="mb-6">
                    <h3>Настройка Zepp OS Simulator</h3>
                    <ol>
                      <li>Установите Zepp OS Simulator, следуя <a href="https://docs.zepp.com/docs/guides/tools/simulator/zepp-os-simulator/" target="_blank" rel="noopener noreferrer">официальной документации</a></li>
                      <li>Создайте новый проект или откройте существующий</li>
                      <li>Извлеките файлы из скачанного .zab пакета</li>
                      <li>Скопируйте файлы в директорию вашего проекта</li>
                      <li>Запустите симулятор и выберите ваш проект</li>
                    </ol>
                  </div>
                  
                  <div className="mb-6">
                    <h3>Тестирование интеграции</h3>
                    <p>Для тестирования интеграции с сервером без устройства можно использовать скрипт test-zepp-integration.js:</p>
                    <ol>
                      <li>Запустите сервер приложения</li>
                      <li>Выполните команду: <code>node test-zepp-integration.js</code></li>
                      <li>Скрипт эмулирует отправку аудиофрагментов с устройства Zepp OS и финализацию записи</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="limitations">
            <Card>
              <CardHeader>
                <CardTitle>Ограничения Zepp OS</CardTitle>
                <CardDescription>
                  Важные ограничения и особенности разработки для Zepp OS
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="mb-6">
                    <h3>Технические ограничения</h3>
                    <ul>
                      <li><strong>Размер памяти:</strong> Ограниченный объем оперативной памяти (около 4MB)</li>
                      <li><strong>Файловая система:</strong> Ограниченное пространство для хранения файлов</li>
                      <li><strong>Время записи:</strong> Максимальная длительность непрерывной записи аудио - около 60 секунд</li>
                      <li><strong>Сетевые запросы:</strong> Ограниченный размер сетевых пакетов, рекомендуется отправлять файлы частями</li>
                      <li><strong>Энергопотребление:</strong> Запись аудио и сетевые операции значительно увеличивают расход батареи</li>
                    </ul>
                  </div>
                  
                  <div className="mb-6">
                    <h3>Структурные особенности</h3>
                    <ul>
                      <li>Необходимо строго соблюдать структуру директорий пакета</li>
                      <li>Зависимость от версии API в файле app.json или manifest.json</li>
                      <li>Различия в путях к файлам между симулятором и реальным устройством</li>
                      <li>Отсутствие полноценной поддержки ES6+ JavaScript</li>
                    </ul>
                  </div>
                  
                  <div className="mb-6">
                    <h3>Рекомендации по разработке</h3>
                    <ul>
                      <li>Разделять аудиозаписи на фрагменты по 30 секунд</li>
                      <li>Использовать легковесные UI-компоненты</li>
                      <li>Минимизировать количество сетевых запросов</li>
                      <li>Добавлять обработку ошибок для всех операций с файлами и сетью</li>
                      <li>Тестировать на реальном устройстве, а не только в симуляторе</li>
                    </ul>
                  </div>
                  
                  <div className="mb-6">
                    <h3>Совместимость</h3>
                    <ul>
                      <li><strong>Поддерживаемые устройства:</strong> Amazfit GTR 3, GTR 3 Pro, GTS 3, T-Rex 2, и новее</li>
                      <li><strong>Версия Zepp OS:</strong> Рекомендуется 2.0 и выше</li>
                      <li><strong>Приложение Zepp:</strong> Последняя версия для Android или iOS</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}