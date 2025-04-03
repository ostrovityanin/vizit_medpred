"""
Утилиты для работы с аудиофайлами.

Предоставляет функции для конвертации и анализа аудиофайлов.
"""

import os
import subprocess
import tempfile
from pathlib import Path
import librosa
import soundfile as sf
import numpy as np

def convert_to_wav(input_path, output_path, sr=16000, mono=True):
    """
    Конвертирует аудиофайл в WAV формат с указанными параметрами.
    
    Args:
        input_path: путь к исходному аудиофайлу
        output_path: путь для сохранения WAV файла
        sr: частота дискретизации (по умолчанию 16кГц)
        mono: конвертировать в моно (по умолчанию True)
    
    Returns:
        output_path: путь к сконвертированному файлу
    """
    try:
        # Создаем команду для FFmpeg
        cmd = [
            'ffmpeg',
            '-y',                   # Перезаписать выходной файл, если существует
            '-i', input_path,       # Входной файл
            '-ar', str(sr),         # Частота дискретизации
            '-ac', '1' if mono else '2',  # Моно или стерео
            '-sample_fmt', 's16',   # 16-бит PCM
            output_path             # Выходной файл
        ]
        
        # Запускаем FFmpeg
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout, stderr = process.communicate()
        
        # Проверяем успешность выполнения
        if process.returncode != 0:
            raise Exception(f"FFmpeg ошибка: {stderr.decode('utf-8')}")
        
        return output_path
        
    except Exception as e:
        # Пробуем альтернативный метод через librosa
        try:
            # Загружаем аудио с помощью librosa
            y, orig_sr = librosa.load(input_path, sr=None, mono=mono)
            
            # Ресемплируем, если необходимо
            if orig_sr != sr:
                y = librosa.resample(y, orig_sr=orig_sr, target_sr=sr)
            
            # Сохраняем в WAV
            sf.write(output_path, y, sr, subtype='PCM_16')
            
            return output_path
            
        except Exception as inner_e:
            raise Exception(f"Ошибка конвертации аудио: {str(e)}. Причина: {str(inner_e)}")

def get_audio_duration(audio_path):
    """
    Получение длительности аудиофайла в секундах.
    
    Args:
        audio_path: путь к аудиофайлу
    
    Returns:
        duration: длительность в секундах
    """
    try:
        # Метод 1: через FFmpeg
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            audio_path
        ]
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout, stderr = process.communicate()
        
        # Если успешно, возвращаем длительность
        if process.returncode == 0:
            return float(stdout.decode('utf-8').strip())
            
    except Exception as e:
        pass  # Пробуем альтернативный метод при ошибке
    
    # Метод 2: через librosa
    try:
        # Загружаем аудио и получаем длительность
        duration = librosa.get_duration(path=audio_path)
        return duration
    except Exception as e:
        raise Exception(f"Не удалось определить длительность аудио: {str(e)}")

def extract_audio_segment(input_path, output_path, start_time, end_time):
    """
    Извлекает сегмент аудио из файла.
    
    Args:
        input_path: путь к исходному аудиофайлу
        output_path: путь для сохранения сегмента
        start_time: время начала сегмента в секундах
        end_time: время конца сегмента в секундах
    
    Returns:
        output_path: путь к извлеченному сегменту
    """
    try:
        # Создаем команду для FFmpeg
        cmd = [
            'ffmpeg',
            '-y',                       # Перезаписать выходной файл
            '-i', input_path,           # Входной файл
            '-ss', str(start_time),     # Время начала
            '-to', str(end_time),       # Время конца
            '-c', 'copy',               # Копировать кодек (быстрее)
            output_path                 # Выходной файл
        ]
        
        # Запускаем FFmpeg
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout, stderr = process.communicate()
        
        # Проверяем успешность выполнения
        if process.returncode != 0:
            raise Exception(f"FFmpeg ошибка: {stderr.decode('utf-8')}")
        
        return output_path
        
    except Exception as e:
        # Альтернативный метод через librosa
        try:
            # Загружаем аудио
            y, sr = librosa.load(input_path, sr=None)
            
            # Вычисляем индексы сэмплов
            start_sample = int(start_time * sr)
            end_sample = int(end_time * sr)
            
            # Вырезаем сегмент
            segment = y[start_sample:end_sample]
            
            # Сохраняем сегмент
            sf.write(output_path, segment, sr)
            
            return output_path
            
        except Exception as inner_e:
            raise Exception(f"Ошибка извлечения сегмента: {str(e)}. Причина: {str(inner_e)}")

def combine_audio_segments(segment_paths, output_path):
    """
    Объединяет несколько аудиосегментов в один файл.
    
    Args:
        segment_paths: список путей к аудиосегментам
        output_path: путь для сохранения объединенного файла
    
    Returns:
        output_path: путь к объединенному файлу
    """
    if not segment_paths:
        raise ValueError("Список сегментов пуст")
    
    try:
        # Создаем временный файл для списка сегментов
        with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False) as f:
            list_file = f.name
            # Записываем пути к сегментам в формате FFmpeg
            for path in segment_paths:
                f.write(f"file '{os.path.abspath(path)}'\n")
        
        # Создаем команду для FFmpeg
        cmd = [
            'ffmpeg',
            '-y',                   # Перезаписать выходной файл
            '-f', 'concat',         # Использовать режим конкатенации
            '-safe', '0',           # Позволяет использовать абсолютные пути
            '-i', list_file,        # Входной файл со списком
            '-c', 'copy',           # Копировать кодек (быстрее)
            output_path             # Выходной файл
        ]
        
        # Запускаем FFmpeg
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout, stderr = process.communicate()
        
        # Удаляем временный файл
        os.unlink(list_file)
        
        # Проверяем успешность выполнения
        if process.returncode != 0:
            raise Exception(f"FFmpeg ошибка: {stderr.decode('utf-8')}")
        
        return output_path
        
    except Exception as e:
        # Альтернативный метод через librosa
        try:
            # Загружаем первый сегмент для определения частоты дискретизации
            y_first, sr = librosa.load(segment_paths[0], sr=None)
            
            # Инициализируем массив для объединенного аудио
            combined = y_first
            
            # Добавляем остальные сегменты
            for path in segment_paths[1:]:
                y, _ = librosa.load(path, sr=sr)  # Загружаем с той же частотой
                combined = np.concatenate((combined, y))
            
            # Сохраняем объединенный файл
            sf.write(output_path, combined, sr)
            
            return output_path
            
        except Exception as inner_e:
            raise Exception(f"Ошибка объединения сегментов: {str(e)}. Причина: {str(inner_e)}")

def analyze_audio(audio_path):
    """
    Анализирует аудиофайл и возвращает его характеристики.
    
    Args:
        audio_path: путь к аудиофайлу
    
    Returns:
        info: словарь с информацией об аудиофайле
    """
    try:
        # Получаем длительность
        duration = get_audio_duration(audio_path)
        
        # Загружаем аудио для анализа
        y, sr = librosa.load(audio_path, sr=None)
        
        # Определяем количество каналов
        channels = 1 if y.ndim == 1 else y.shape[0]
        
        # Вычисляем RMS энергию для оценки громкости
        rms = np.sqrt(np.mean(y**2))
        
        # Вычисляем пиковую амплитуду
        peak = np.max(np.abs(y))
        
        # Вычисляем отношение сигнал/шум
        if np.mean(y**2) > 0:
            snr = 10 * np.log10(np.mean(y**2) / np.var(y))
        else:
            snr = float('-inf')
        
        # Формируем результат
        info = {
            'duration': duration,
            'sample_rate': sr,
            'channels': channels,
            'rms': float(rms),
            'peak': float(peak),
            'snr': float(snr),
            'format': os.path.splitext(audio_path)[1][1:]
        }
        
        return info
        
    except Exception as e:
        raise Exception(f"Ошибка анализа аудио: {str(e)}")