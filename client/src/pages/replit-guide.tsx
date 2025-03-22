import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, ExternalLink } from "lucide-react";

export default function ReplitGuide() {
  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="mr-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span>Назад</span>
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Как открыть локальные проекты в Replit</h1>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Доступ к вашим Replit проектам</CardTitle>
            <CardDescription>
              Инструкция по открытию и запуску локальных проектов в Replit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <h2>Способ 1: Через Webview</h2>
              <p>
                Самый простой способ доступа к локальным проектам в Replit - использовать встроенный Webview, 
                который автоматически создает URL для доступа к вашему серверу.
              </p>
              
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  <strong>Откройте ваш проект в Replit</strong>
                  <p>Войдите в свой аккаунт Replit и откройте нужный проект.</p>
                </li>
                <li>
                  <strong>Запустите сервер</strong>
                  <p>Нажмите на кнопку "Run" вверху, чтобы запустить сервер.</p>
                </li>
                <li>
                  <strong>Откройте вкладку Webview</strong>
                  <p>
                    В верхней части интерфейса найдите вкладку "Webview" (обычно справа от вкладки "Console").
                    Это автоматически откроет браузер, показывающий ваш проект на порту 5000.
                  </p>
                </li>
                <li>
                  <strong>Используйте URL из Webview</strong>
                  <p>
                    Webview создаст URL вида <code>https://your-project-name.username.repl.co</code>, 
                    который вы можете использовать для доступа к проекту из любого браузера.
                  </p>
                </li>
              </ol>

              <div className="bg-primary/10 p-4 rounded-md mt-4">
                <p className="font-medium">Пример URL:</p>
                <code>https://sound-timer-tracker-nivarank.replit.app</code>
              </div>
            </div>

            <div className="prose prose-sm dark:prose-invert max-w-none">
              <h2>Способ 2: Через порт 5000 (локально)</h2>
              <p>
                Если вы работаете непосредственно в редакторе Replit, вы также можете получить доступ к вашему 
                проекту через порт 5000 локально.
              </p>
              
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  <strong>Запустите сервер в Replit</strong>
                  <p>Убедитесь, что ваш проект запущен и сервер работает.</p>
                </li>
                <li>
                  <strong>Откройте локальный URL</strong>
                  <p>
                    В браузере внутри Replit или в отдельной вкладке введите: <code>http://localhost:5000</code>
                  </p>
                </li>
                <li>
                  <strong>Доступ к специфическим страницам</strong>
                  <p>
                    Для перехода на определенные страницы или маршруты добавьте их к URL.
                    Например: <code>http://localhost:5000/zepp-os-docs</code>
                  </p>
                </li>
              </ol>
            </div>

            <div className="prose prose-sm dark:prose-invert max-w-none">
              <h2>Способ 3: Загрузка файлов из проекта</h2>
              <p>
                Чтобы скачать или получить доступ к определенным файлам из вашего проекта:
              </p>
              
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  <strong>Поместите файлы в директорию public</strong>
                  <p>
                    Любые файлы, помещенные в директорию <code>client/public/</code>, будут доступны напрямую через URL вашего проекта.
                  </p>
                </li>
                <li>
                  <strong>Используйте прямые ссылки</strong>
                  <p>
                    Для доступа к файлу используйте формат:<br />
                    <code>http://localhost:5000/имя_файла.расширение</code> (локально) или<br />
                    <code>https://your-project-name.username.repl.co/имя_файла.расширение</code> (публично)
                  </p>
                </li>
                <li>
                  <strong>Примеры доступа к файлам:</strong>
                  <ul className="list-disc pl-6">
                    <li>
                      <code>http://localhost:5000/basic_zepp.zab</code> - доступ к файлу basic_zepp.zab
                    </li>
                    <li>
                      <code>http://localhost:5000/zepp_all_packages.zip</code> - скачивание архива с пакетами
                    </li>
                    <li>
                      <code>http://localhost:5000/zepp_installation_guide_updated.md</code> - просмотр руководства
                    </li>
                  </ul>
                </li>
              </ol>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-md border border-yellow-200 dark:border-yellow-800">
              <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-2">Важно помнить</h3>
              <ul className="list-disc pl-6 text-yellow-700 dark:text-yellow-300 space-y-1">
                <li>Ваш проект должен быть запущен для доступа к файлам и страницам</li>
                <li>Порт 5000 стандартный для большинства проектов, но может отличаться в зависимости от настроек</li>
                <li>Публичные URL (с .repl.co) будут работать только если ваш проект публичный или поделенный</li>
                <li>Для непрерывного доступа к проекту используйте функцию "Always On" в Replit (требуется подписка)</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <a href="https://replit.com/~" target="_blank" rel="noopener noreferrer" className="no-underline">
                <Button className="w-full sm:w-auto flex items-center">
                  Открыть Replit
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </a>
              
              <a href="https://docs.replit.com/" target="_blank" rel="noopener noreferrer" className="no-underline">
                <Button variant="outline" className="w-full sm:w-auto flex items-center">
                  Документация Replit
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}