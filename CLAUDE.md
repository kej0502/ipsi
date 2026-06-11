# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

```
python digit_recognizer.py
```

Or double-click `숫자인식_실행.bat` on Windows (sets UTF-8 console and runs the script).

**Dependencies:** `numpy`, `pillow`, `scikit-learn`, `scipy`

## Architecture

Single-file app (`digit_recognizer.py`) structured in five sections:

1. **Dataset loading** — attempts MNIST via `fetch_openml` (70k samples, 28×28); falls back to sklearn's built-in 8×8 digits if the download fails. `MODEL_SIZE` and `dataset_type` globals are set here and propagate to the rest of the app.

2. **Training** — `StandardScaler` + `MLPClassifier(hidden_layer_sizes=(512, 256))` with early stopping. Trained once at startup; no model persistence.

3. **Preprocessing (`preprocess_drawing`)** — converts the PIL canvas image to a feature vector. Key steps: bounding-box crop → proportional padding → square-pad → resize to `MODEL_SIZE` → invert (strokes become bright, matching training convention) → flatten. This function is where drawing-to-prediction quality lives.

4. **GUI (`DigitRecognizerApp`)** — tkinter canvas (280×280 px) with a parallel PIL image that receives the same strokes. Predict button calls `preprocess_drawing`, scales with the fitted `StandardScaler`, and shows the top-3 class probabilities.

5. **Entry point** — `__main__` block only.

## Key Constants

| Name | Value | Purpose |
|---|---|---|
| `CANVAS_SIZE` | 280 | tkinter canvas and PIL image dimensions |
| `PEN_WIDTH` | 22 | stroke radius in pixels |
| `MODEL_SIZE` | 28 (or 8) | resize target matching training resolution |
