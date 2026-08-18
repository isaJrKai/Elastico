"""
Phase 3: Train XGBoost and LSTM on real football-data.co.uk data.

Methodology:
- Load all CSV files from data/historical/
- Feature engineering via canonical schema (50 features)
- Time-aware 60/20/20 split
- XGBoost with early stopping
- LSTM with genuine temporal sequences from match history
- Save models with full metadata (feature schema, training period, metrics)
"""

import sys
import os
import json
from datetime import datetime
from pathlib import Path

PROJECT = '/home/z/my-project/football-prediction-mega'
sys.path.insert(0, PROJECT)
os.chdir(PROJECT)

import numpy as np
import pandas as pd

# =======================================================================
# STEP 1: Load and combine all CSV data
# =======================================================================

print('=' * 60)
print('PHASE 3: Training XGBoost and LSTM on real data')
print('=' * 60)

DATA_DIR = Path(PROJECT) / 'data' / 'historical'
MODEL_DIR = Path(PROJECT) / 'saved_models'
METRICS_DIR = Path(PROJECT) / 'saved_metrics'
MODEL_DIR.mkdir(parents=True, exist_ok=True)
METRICS_DIR.mkdir(parents=True, exist_ok=True)

from src.services.csv_ingestion import CSVIngestionService

csv_service = CSVIngestionService(data_dir=str(DATA_DIR))
df_all = csv_service.load_all_available()

if df_all.empty:
    print('FATAL: No data loaded. Aborting training.')
    sys.exit(1)

n_csv = len(list(DATA_DIR.glob('*.csv')))
print(f'\nLoaded {len(df_all)} matches from {n_csv} CSV files')
league_col = 'league_code' if 'league_code' in df_all.columns else 'league_name'
print(f'Leagues: {df_all[league_col].unique().tolist()}')
if 'Date' in df_all.columns:
    print(f'Date range: {df_all["Date"].min()} to {df_all["Date"].max()}')

# Convert to match dicts for the ML pipeline
matches = csv_service.to_match_dicts(df_all)
print(f'Converted to {len(matches)} match dicts')

# =======================================================================
# STEP 2: XGBoost Training
# =======================================================================

print('\n' + '=' * 60)
print('TRAINING XGBoost')
print('=' * 60)

from src.ml.features import FeatureEngineer
from src.ml.xgboost_engine import XGBoostEngine, XGBoostConfig
from src.ml.feature_schema import FEATURE_NAMES, N_FEATURES

print(f'Feature schema: {N_FEATURES} features')

# Build training dataset
engineer = FeatureEngineer(league_avg_goals=1.35)
df_features = engineer.build_training_dataset(matches, window=10)

print(f'Feature matrix: {df_features.shape[0]} samples x {df_features.shape[1]} features')

# Remove invalid targets
df_features = df_features[df_features["target"].isin([0.0, 1.0, 2.0])].reset_index(drop=True)
print(f'After filtering: {len(df_features)} valid samples')

if len(df_features) < 100:
    print('FATAL: Too few samples for training. Aborting.')
    sys.exit(1)

# Time-aware split (60/20/20)
n = len(df_features)
tr_end = int(n * 0.6)
val_end = int(n * 0.8)

X_train = df_features.iloc[:tr_end][FEATURE_NAMES].values.astype(np.float32)
y_train = df_features.iloc[:tr_end]['target'].values.astype(np.int32)

X_val = df_features.iloc[tr_end:val_end][FEATURE_NAMES].values.astype(np.float32)
y_val = df_features.iloc[tr_end:val_end]['target'].values.astype(np.int32)

X_test = df_features.iloc[val_end:][FEATURE_NAMES].values.astype(np.float32)
y_test = df_features.iloc[val_end:]['target'].values.astype(np.int32)

print(f'Split: train={len(y_train)}, val={len(y_val)}, test={len(y_test)}')
if 'date' in df_features.columns:
    print(f'Train date range: {df_features.iloc[:tr_end]["date"].min()} to {df_features.iloc[tr_end-1]["date"].max()}')
    print(f'Test date range: {df_features.iloc[val_end:]["date"].min()} to {df_features.iloc[val_end:]["date"].max()}')

# Train XGBoost
xgb_config = XGBoostConfig(
    n_estimators=500,
    max_depth=6,
    learning_rate=0.05,
    early_stopping_rounds=50,
)
xgb_engine = XGBoostEngine(config=xgb_config, model_dir=str(MODEL_DIR))

train_metrics = xgb_engine.train(
    X_train, y_train,
    X_val=X_val, y_val=y_val,
    feature_names=FEATURE_NAMES,
)

print(f'\nXGBoost training complete:')
print(f'  Best iteration: {train_metrics.get("best_iteration")}')
print(f'  Train log-loss: {train_metrics.get("training_logloss_best", 0):.4f}')
print(f'  Val log-loss: {train_metrics.get("validation_logloss_best", 0):.4f}')

# Evaluate on test set
test_metrics = xgb_engine.evaluate(X_test, y_test)
print(f'\nXGBoost Test Evaluation:')
print(f'  Accuracy: {test_metrics["accuracy"]:.4f}')
print(f'  Log-loss: {test_metrics["log_loss"]:.4f}')
print(f'  Brier: {test_metrics["brier_score"]:.4f}')
print(f'  Macro F1: {test_metrics["macro_f1"]:.4f}')
for cls, m in test_metrics['per_class'].items():
    print(f'  {cls}: P={m["precision"]:.3f} R={m["recall"]:.3f} F1={m["f1"]:.3f} (n={m["support"]})')

# Save model
model_path = xgb_engine.save(name='xgboost_v1')
print(f'\nXGBoost model saved to: {model_path}')

# Calibration report
from src.ml.training_pipeline import TrainingPipeline
test_proba = xgb_engine.model.predict_proba(X_test)
calibration = TrainingPipeline.compute_calibration_report(y_test, test_proba)
print(f'\nCalibration:')
print(f'  Overall ECE: {calibration["overall_ece"]:.4f}')
for cls, ece in calibration['per_class_ece'].items():
    print(f'  {cls} ECE: {ece:.4f}')

# Save comprehensive metrics
xgb_metrics_report = {
    "status": "success",
    "model_type": "xgboost",
    "model_version": "xgboost_v1",
    "timestamp": datetime.now().isoformat(),
    "data_source": "football-data.co.uk",
    "dataset_version": "5-leagues-4-seasons",
    "leagues": ["E0", "SP1", "I1", "D1", "F1"],
    "seasons": ["2021-22", "2022-23", "2023-24", "2024-25"],
    "n_matches_loaded": len(df_all),
    "n_samples_after_features": len(df_features),
    "n_features": N_FEATURES,
    "feature_schema": "canonical_v1",
    "split": {
        "train": len(y_train),
        "val": len(y_val),
        "test": len(y_test),
    },
    "training": train_metrics,
    "evaluation": test_metrics,
    "calibration": calibration,
    "model_path": model_path,
    "training_period": {
        "train_start": str(df_features.iloc[:tr_end]['date'].min()) if 'date' in df_features.columns else 'unknown',
        "train_end": str(df_features.iloc[tr_end-1]['date'].max()) if 'date' in df_features.columns else 'unknown',
        "test_start": str(df_features.iloc[val_end:]['date'].min()) if 'date' in df_features.columns else 'unknown',
        "test_end": str(df_features.iloc[val_end:]['date'].max()) if 'date' in df_features.columns else 'unknown',
    },
}

ts = datetime.now().strftime('%Y%m%d_%H%M%S')
metrics_path = METRICS_DIR / f'xgboost_v1_metrics_{ts}.json'
with open(metrics_path, 'w') as f:
    json.dump(xgb_metrics_report, f, indent=2, default=str)
print(f'Metrics saved to: {metrics_path}')

# =======================================================================
# STEP 3: LSTM Training (with genuine temporal sequences)
# =======================================================================

print('\n' + '=' * 60)
print('TRAINING LSTM')
print('=' * 60)

from src.ml.lstm_engine import LSTMEngine, LSTMConfig
from src.ml.feature_schema import LSTM_SEQUENCE_FEATURES, N_LSTM_FEATURES

print(f'LSTM feature schema: {N_LSTM_FEATURES} features')
print(f'Features: {LSTM_SEQUENCE_FEATURES}')

lstm_engine = LSTMEngine(
    config=LSTMConfig(
        input_size=N_LSTM_FEATURES,
        hidden_size=64,
        num_layers=2,
        dropout=0.3,
        sequence_length=10,
        epochs=100,
        early_stopping_patience=15,
    ),
    model_dir=str(MODEL_DIR),
)
lstm_engine.feature_cols = list(LSTM_SEQUENCE_FEATURES)

# Build genuine temporal sequences
X_home, X_away, y_lstm = lstm_engine.build_sequences(matches, list(LSTM_SEQUENCE_FEATURES))
print(f'LSTM sequences built: {len(y_lstm)} samples, shape: {X_home.shape}')

if len(y_lstm) < 100:
    print(f'WARNING: Only {len(y_lstm)} LSTM samples -- training with reduced epochs')

# Time-aware split
n_lstm = len(y_lstm)
lstm_tr_end = int(n_lstm * 0.7)
lstm_val_end = int(n_lstm * 0.85)

lstm_train_metrics = lstm_engine.train(
    X_home[:lstm_tr_end],
    X_away[:lstm_tr_end],
    y_lstm[:lstm_tr_end],
    X_val_home=X_home[lstm_tr_end:lstm_val_end],
    X_val_away=X_away[lstm_tr_end:lstm_val_end],
    y_val=y_lstm[lstm_tr_end:lstm_val_end],
)

print(f'\nLSTM training complete:')
print(f'  Epochs run: {lstm_train_metrics.get("epochs_run")}')
print(f'  Best epoch: {lstm_train_metrics.get("best_epoch")}')
print(f'  Best train loss: {lstm_train_metrics.get("train_loss_best", 0):.4f}')
print(f'  Best val loss: {lstm_train_metrics.get("val_loss_best", "N/A")}')

# Evaluate on test set
lstm_test_metrics = lstm_engine.evaluate(
    X_home[lstm_val_end:],
    X_away[lstm_val_end:],
    y_lstm[lstm_val_end:],
)

print(f'\nLSTM Test Evaluation:')
print(f'  Accuracy: {lstm_test_metrics["accuracy"]:.4f}')
print(f'  Log-loss: {lstm_test_metrics["log_loss"]:.4f}')
print(f'  Brier: {lstm_test_metrics["brier_score"]:.4f}')
print(f'  ECE: {lstm_test_metrics["ece"]:.4f}')
print(f'  Macro F1: {lstm_test_metrics["macro_f1"]:.4f}')
for cls, m in lstm_test_metrics['per_class'].items():
    print(f'  {cls}: P={m["precision"]:.3f} R={m["recall"]:.3f} F1={m["f1"]:.3f} (n={m["support"]})')

# Save LSTM model
lstm_model_path = lstm_engine.save(name='lstm_v1')
print(f'\nLSTM model saved to: {lstm_model_path}')

# Save LSTM metrics
lstm_metrics_report = {
    "status": "success",
    "model_type": "lstm",
    "model_version": "lstm_v1",
    "timestamp": datetime.now().isoformat(),
    "data_source": "football-data.co.uk",
    "dataset_version": "5-leagues-4-seasons",
    "leagues": ["E0", "SP1", "I1", "D1", "F1"],
    "seasons": ["2021-22", "2022-23", "2023-24", "2024-25"],
    "n_matches_loaded": len(df_all),
    "n_sequences_built": len(y_lstm),
    "n_features": N_LSTM_FEATURES,
    "feature_schema": "canonical_lstm_v1",
    "feature_cols": list(LSTM_SEQUENCE_FEATURES),
    "sequence_length": lstm_engine.config.sequence_length,
    "split": {
        "train": lstm_tr_end,
        "val": lstm_val_end - lstm_tr_end,
        "test": n_lstm - lstm_val_end,
    },
    "training": lstm_train_metrics,
    "evaluation": lstm_test_metrics,
    "model_path": lstm_model_path,
}

ts2 = datetime.now().strftime('%Y%m%d_%H%M%S')
lstm_metrics_path = METRICS_DIR / f'lstm_v1_metrics_{ts2}.json'
with open(lstm_metrics_path, 'w') as f:
    json.dump(lstm_metrics_report, f, indent=2, default=str)
print(f'LSTM metrics saved to: {lstm_metrics_path}')

print('\n' + '=' * 60)
print('PHASE 3 COMPLETE')
print('=' * 60)
print(f'XGBoost: accuracy={test_metrics["accuracy"]:.4f}, log_loss={test_metrics["log_loss"]:.4f}')
print(f'LSTM:    accuracy={lstm_test_metrics["accuracy"]:.4f}, log_loss={lstm_test_metrics["log_loss"]:.4f}')
