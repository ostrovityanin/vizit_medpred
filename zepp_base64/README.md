# Пакеты Zepp OS в формате Base64

Ниже представлены закодированные в base64 пакеты Zepp OS. Для преобразования обратно в бинарные файлы используйте одну из следующих команд:

## Linux/Mac:
```bash
echo 'BASE64_СТРОКА' | base64 -d > имя_файла.zab
```

## Windows (PowerShell):
```powershell
[System.Convert]::FromBase64String('BASE64_СТРОКА') | Set-Content -Path имя_файла.zab -Encoding Byte
```

## Python:
```python
import base64
with open('имя_файла.zab', 'wb') as f:
    f.write(base64.b64decode('BASE64_СТРОКА'))
```

