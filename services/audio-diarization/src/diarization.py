"""
Модуль для диаризации аудио (определения говорящих).

Использует спектральные признаки и кластеризацию для разделения аудио
на сегменты с разными говорящими.
"""

import os
import sys
import json
import argparse
from pathlib import Path

# Импортируем необходимые библиотеки
import numpy as np
import librosa
from sklearn.cluster import AgglomerativeClustering
from sklearn.preprocessing import StandardScaler

# Добавляем директорию utils в путь импорта
utils_dir = Path(__file__).parent.parent / "utils"
sys.path.append(str(utils_dir))

# Импортируем собственные утилиты
import audio_utils
from logger import setup_logger

# Настраиваем логгер
logger = setup_logger("diarization")

def extract_features(audio_path):
    """
    Извлечение спектральных признаков из аудиофайла.
    
    Args:
        audio_path: путь к аудиофайлу
        
    Returns:
        features: массив признаков
        frames: временные метки фреймов
        y: аудиоданные
        sr: частота дискретизации
    """
    logger.info(f"Извлечение признаков из {audio_path}")
    
    # Загружаем аудио
    y, sr = librosa.load(audio_path, sr=16000, mono=True)
    
    # Вычисляем MFCCs (Mel-frequency cepstral coefficients)
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    
    # Вычисляем дельта признаки (изменение во времени)
    delta_mfccs = librosa.feature.delta(mfccs)
    
    # Вычисляем контраст спектра
    spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
    
    # Объединяем признаки
    features = np.vstack([mfccs, delta_mfccs, spectral_contrast])
    
    # Транспонируем для получения формата (фреймы, признаки)
    features = features.T
    
    # Получаем временные метки фреймов
    frames = librosa.times_like(features, sr=sr)
    
    logger.info(f"Извлечено {features.shape[0]} фреймов с {features.shape[1]} признаками")
    
    return features, frames, y, sr

def detect_voice_activity(y, sr, threshold_db=-40):
    """
    Определение участков с голосовой активностью.
    
    Args:
        y: аудиоданные
        sr: частота дискретизации
        threshold_db: порог в дБ для определения речи
        
    Returns:
        vad_segments: список сегментов с речью (start, end)
    """
    logger.info("Определение голосовой активности")
    
    # Вычисляем энергию сигнала
    energy = librosa.feature.rms(y=y)[0]
    energy_db = librosa.amplitude_to_db(energy)
    
    # Находим кадры с энергией выше порога
    speech_frames = np.where(energy_db > threshold_db)[0]
    
    # Если нет речи, возвращаем пустой список
    if len(speech_frames) == 0:
        logger.warning("Речь не обнаружена")
        return []
    
    # Находим границы сегментов
    segment_boundaries = []
    start_idx = speech_frames[0]
    
    for i in range(1, len(speech_frames)):
        if speech_frames[i] - speech_frames[i-1] > 1:
            # Конец сегмента
            end_idx = speech_frames[i-1]
            segment_boundaries.append((start_idx, end_idx))
            # Новый сегмент
            start_idx = speech_frames[i]
    
    # Добавляем последний сегмент
    segment_boundaries.append((start_idx, speech_frames[-1]))
    
    # Преобразуем индексы фреймов во временные метки
    frame_length = 2048  # Стандартный размер окна в librosa
    hop_length = 512     # Стандартный размер перекрытия в librosa
    
    vad_segments = []
    for start_frame, end_frame in segment_boundaries:
        start_time = librosa.frames_to_time(start_frame, sr=sr, hop_length=hop_length)
        end_time = librosa.frames_to_time(end_frame, sr=sr, hop_length=hop_length)
        
        # Минимальная длительность сегмента - 0.5 секунды
        if end_time - start_time >= 0.5:
            vad_segments.append((start_time, end_time))
    
    logger.info(f"Обнаружено {len(vad_segments)} сегментов с речью")
    
    return vad_segments

def cluster_speakers(features, frames, vad_segments, min_speakers=1, max_speakers=10):
    """
    Кластеризация говорящих на основе спектральных признаков.
    
    Args:
        features: массив признаков
        frames: временные метки для фреймов
        vad_segments: сегменты с голосовой активностью
        min_speakers: минимальное количество говорящих
        max_speakers: максимальное количество говорящих
        
    Returns:
        speaker_segments: список сегментов с идентификатором говорящего
    """
    from sklearn.metrics import silhouette_score
    
    logger.info("Кластеризация говорящих")
    
    # Если нет сегментов с речью, возвращаем пустой список
    if not vad_segments:
        logger.warning("Нет сегментов с речью для кластеризации")
        return []
    
    # Создаем маску для фреймов с речью
    speech_mask = np.zeros(len(frames), dtype=bool)
    for start_time, end_time in vad_segments:
        # Находим индексы фреймов в указанном временном диапазоне
        speech_idx = np.where((frames >= start_time) & (frames <= end_time))[0]
        speech_mask[speech_idx] = True
    
    # Выбираем только признаки для фреймов с речью
    speech_features = features[speech_mask]
    speech_frames = frames[speech_mask]
    
    if len(speech_features) == 0:
        logger.warning("Нет признаков для кластеризации")
        return []
    
    # Нормализуем признаки
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(speech_features)
    
    # Определяем оптимальное количество кластеров
    best_score = -1
    best_n_clusters = min_speakers
    silhouette_scores = []
    
    # Проверяем разное количество кластеров
    for n_clusters in range(min_speakers, min(max_speakers + 1, len(scaled_features))):
        if n_clusters <= 1:
            continue
            
        # Кластеризация
        clustering = AgglomerativeClustering(
            n_clusters=n_clusters,
            affinity='euclidean',
            linkage='ward'
        )
        cluster_labels = clustering.fit_predict(scaled_features)
        
        # Если все образцы попали в один кластер, пропускаем
        if len(np.unique(cluster_labels)) <= 1:
            continue
            
        # Вычисляем коэффициент силуэта
        try:
            score = silhouette_score(scaled_features, cluster_labels)
            silhouette_scores.append((n_clusters, score))
            
            if score > best_score:
                best_score = score
                best_n_clusters = n_clusters
        except Exception as e:
            logger.warning(f"Ошибка при вычислении силуэта для {n_clusters} кластеров: {e}")
    
    # Если не удалось найти оптимальное количество кластеров, используем минимальное
    if best_n_clusters == min_speakers and len(silhouette_scores) > 0:
        logger.info(f"Не удалось определить оптимальное количество говорящих, использую {min_speakers}")
    else:
        logger.info(f"Оптимальное количество говорящих: {best_n_clusters}")
    
    # Кластеризация с оптимальным количеством кластеров
    clustering = AgglomerativeClustering(
        n_clusters=best_n_clusters,
        affinity='euclidean',
        linkage='ward'
    )
    cluster_labels = clustering.fit_predict(scaled_features)
    
    # Создаем сегменты с идентификатором говорящего
    speaker_segments = []
    
    # Объединяем последовательные фреймы с одинаковым говорящим
    current_speaker = cluster_labels[0]
    segment_start = speech_frames[0]
    
    for i in range(1, len(speech_frames)):
        # Если сменился говорящий или большой промежуток между фреймами
        if cluster_labels[i] != current_speaker or (speech_frames[i] - speech_frames[i-1]) > 1.0:
            # Сохраняем предыдущий сегмент
            segment_end = speech_frames[i-1]
            speaker_segments.append({
                'speaker': int(current_speaker),
                'start': float(segment_start),
                'end': float(segment_end)
            })
            
            # Начинаем новый сегмент
            current_speaker = cluster_labels[i]
            segment_start = speech_frames[i]
    
    # Добавляем последний сегмент
    speaker_segments.append({
        'speaker': int(current_speaker),
        'start': float(segment_start),
        'end': float(speech_frames[-1])
    })
    
    # Объединяем близкие сегменты одного и того же говорящего
    merged_segments = []
    if speaker_segments:
        current = speaker_segments[0]
        
        for next_segment in speaker_segments[1:]:
            # Если тот же говорящий и небольшой промежуток
            if next_segment['speaker'] == current['speaker'] and (next_segment['start'] - current['end']) < 0.5:
                # Объединяем сегменты
                current['end'] = next_segment['end']
            else:
                # Сохраняем текущий сегмент и переходим к следующему
                merged_segments.append(current)
                current = next_segment
        
        # Добавляем последний сегмент
        merged_segments.append(current)
    
    logger.info(f"Создано {len(merged_segments)} сегментов с {best_n_clusters} говорящими")
    
    return merged_segments

def process_diarization(audio_path, min_speakers=1, max_speakers=10, return_segments=False):
    """
    Основная функция для выполнения диаризации аудио.
    
    Args:
        audio_path: путь к аудиофайлу
        min_speakers: минимальное количество говорящих
        max_speakers: максимальное количество говорящих
        return_segments: возвращать ли файлы сегментов
        
    Returns:
        result: словарь с результатами диаризации
    """
    logger.info(f"Начало диаризации для файла: {audio_path}")
    
    # Конвертируем аудиофайл в WAV для обработки
    temp_wav = os.path.join(os.path.dirname(audio_path), "temp_diarize.wav")
    audio_utils.convert_to_wav(audio_path, temp_wav, sr=16000, mono=True)
    
    # Извлекаем признаки
    features, frames, y, sr = extract_features(temp_wav)
    
    # Определяем голосовую активность
    vad_segments = detect_voice_activity(y, sr)
    
    # Кластеризуем говорящих
    speaker_segments = cluster_speakers(features, frames, vad_segments, min_speakers, max_speakers)
    
    # Удаляем временный WAV файл
    if os.path.exists(temp_wav):
        os.remove(temp_wav)
    
    # Формируем результат
    result = {
        'audio_path': audio_path,
        'duration': float(librosa.get_duration(y=y, sr=sr)),
        'num_speakers': len(set(segment['speaker'] for segment in speaker_segments)) if speaker_segments else 0,
        'segments': speaker_segments
    }
    
    logger.info(f"Диаризация завершена. Обнаружено говорящих: {result['num_speakers']}")
    
    return result

if __name__ == "__main__":
    # Парсим аргументы командной строки
    parser = argparse.ArgumentParser(description='Диаризация аудио (определение говорящих)')
    parser.add_argument('--audio_path', required=True, help='Путь к аудиофайлу')
    parser.add_argument('--min_speakers', type=int, default=1, help='Минимальное количество говорящих')
    parser.add_argument('--max_speakers', type=int, default=10, help='Максимальное количество говорящих')
    parser.add_argument('--output_dir', default=None, help='Директория для сохранения результатов')
    
    args = parser.parse_args()
    
    # Проверяем существование аудиофайла
    if not os.path.exists(args.audio_path):
        logger.error(f"Аудиофайл не найден: {args.audio_path}")
        sys.exit(1)
    
    # Создаем выходную директорию при необходимости
    if args.output_dir and not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir, exist_ok=True)
    
    # Выполняем диаризацию
    result = process_diarization(
        args.audio_path,
        min_speakers=args.min_speakers,
        max_speakers=args.max_speakers
    )
    
    # Сохраняем результат в JSON
    if args.output_dir:
        result_path = os.path.join(args.output_dir, 'result.json')
        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Результаты сохранены в {result_path}")
    else:
        # Выводим результат в stdout
        print(json.dumps(result, ensure_ascii=False, indent=2))