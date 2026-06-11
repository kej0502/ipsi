"""
Handwritten Digit Recognizer
- Drawing canvas built with tkinter
- MLPClassifier trained on MNIST (28x28), falling back to sklearn digits (8x8)
- Bounding-box normalization aligns drawn strokes with training-data layout
"""

import tkinter as tk
from tkinter import font as tkfont
import numpy as np
from PIL import Image, ImageDraw
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import warnings
warnings.filterwarnings("ignore")

# ---------------------------------------------------------------------------
# 1. Load dataset (MNIST preferred; fall back to sklearn built-in digits)
# ---------------------------------------------------------------------------

MODEL_SIZE   = 28   # will be overridden to 8 if MNIST fetch fails
dataset_type = "mnist"

def load_mnist():
    """Download MNIST via sklearn's openml gateway (cached after first run)."""
    from sklearn.datasets import fetch_openml
    print("Fetching MNIST dataset (cached after first download)...")
    ds = fetch_openml("mnist_784", version=1, as_frame=False, parser="auto")
    X = ds.data.astype(np.float64) / 255.0          # 0-1 float, shape (70000, 784)
    y = ds.target.astype(int)
    # Use 20,000 samples to keep training under ~30 s
    rng = np.random.RandomState(42)
    idx = rng.choice(len(X), size=20000, replace=False)
    return X[idx], y[idx]

def load_fallback():
    """Use sklearn's built-in 8x8 digit images (1,797 samples)."""
    from sklearn.datasets import load_digits
    from scipy.ndimage import shift as ndimage_shift
    print("Using built-in sklearn digits (8x8). Quality may be lower.")
    ds = load_digits()
    X_raw = ds.data.astype(np.float64) / 16.0      # 0-1 float
    y_raw = ds.target

    # Augment with small pixel shifts to improve generalisation
    X_parts, y_parts = [X_raw], [y_raw]
    for dx in [-1, 1]:
        for dy in [-1, 1]:
            shifted = np.array([
                ndimage_shift(
                    x.reshape(8, 8), [dy, dx], mode="constant", cval=0
                ).flatten()
                for x in X_raw
            ])
            X_parts.append(shifted)
            y_parts.append(y_raw)
    return np.vstack(X_parts), np.concatenate(y_parts)

try:
    X, y = load_mnist()
    MODEL_SIZE = 28
except Exception as exc:
    print(f"MNIST fetch failed ({exc}); using built-in digits.")
    X, y = load_fallback()
    MODEL_SIZE = 8
    dataset_type = "digits8"

print(f"Dataset: {dataset_type}  |  samples: {len(X)}  |  model input: {MODEL_SIZE}x{MODEL_SIZE}")

# ---------------------------------------------------------------------------
# 2. Train
# ---------------------------------------------------------------------------

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y, test_size=0.15, random_state=42, stratify=y
)

print("Training MLP classifier...")
model = MLPClassifier(
    hidden_layer_sizes=(512, 256),
    activation="relu",
    max_iter=30,                # early stopping handles the rest
    early_stopping=True,
    validation_fraction=0.1,
    n_iter_no_change=5,
    random_state=42,
    verbose=False,
)
model.fit(X_train, y_train)

accuracy = model.score(X_test, y_test)
print(f"Model ready - test accuracy: {accuracy:.2%}")

# ---------------------------------------------------------------------------
# 3. Image preprocessing helper
# ---------------------------------------------------------------------------

CANVAS_SIZE = 280
PEN_WIDTH   = 22    # thick enough to show up well in the downsampled image


def preprocess_drawing(pil_img: Image.Image) -> np.ndarray | None:
    """
    Convert a PIL grayscale image (white bg, black strokes) to a 1-D feature
    vector compatible with the trained model.

    Steps:
      1. Find the bounding box of drawn pixels (dark pixels < threshold).
      2. Crop to that box and add proportional padding.
      3. Centre-pad to a square.
      4. Resize to MODEL_SIZE x MODEL_SIZE with anti-aliasing.
      5. Invert so strokes are bright (training convention).
      6. Normalise to 0-1.
    """
    arr = np.array(pil_img, dtype=np.uint8)

    # Locate drawn pixels
    dark_mask = arr < 200
    if not dark_mask.any():
        return None     # canvas is blank

    rows = np.any(dark_mask, axis=1)
    cols = np.any(dark_mask, axis=0)
    r_min, r_max = np.where(rows)[0][[0, -1]]
    c_min, c_max = np.where(cols)[0][[0, -1]]

    # Padding: 15% of the bounding-box size, at least 8 px
    pad = max(8, int(max(r_max - r_min, c_max - c_min) * 0.15))
    r_min = max(0, r_min - pad)
    r_max = min(arr.shape[0] - 1, r_max + pad)
    c_min = max(0, c_min - pad)
    c_max = min(arr.shape[1] - 1, c_max + pad)

    cropped = pil_img.crop((c_min, r_min, c_max + 1, r_max + 1))

    # Make square with white padding so aspect ratio is preserved
    w, h    = cropped.size
    side    = max(w, h)
    square  = Image.new("L", (side, side), color=255)
    square.paste(cropped, ((side - w) // 2, (side - h) // 2))

    # Resize to model input resolution
    resized = square.resize((MODEL_SIZE, MODEL_SIZE), Image.LANCZOS)
    feat    = np.array(resized, dtype=np.float64)

    # Invert: PIL has 255=white (background) -> 0, 0=black (stroke) -> 1
    feat = (255.0 - feat) / 255.0

    return feat.flatten()

# ---------------------------------------------------------------------------
# 4. GUI
# ---------------------------------------------------------------------------

class DigitRecognizerApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        root.title(f"Handwritten Digit Recognizer  [{dataset_type}]")
        root.resizable(False, False)

        self.pil_img  = Image.new("L", (CANVAS_SIZE, CANVAS_SIZE), color=255)
        self.pil_draw = ImageDraw.Draw(self.pil_img)
        self._last_xy = None    # for smooth line drawing

        self._build_ui()

    # ------------------------------------------------------------------
    def _build_ui(self) -> None:
        header_font = tkfont.Font(family="Segoe UI", size=13, weight="bold")
        result_font = tkfont.Font(family="Segoe UI", size=28, weight="bold")
        label_font  = tkfont.Font(family="Segoe UI", size=11)
        btn_font    = tkfont.Font(family="Segoe UI", size=12, weight="bold")

        tk.Label(
            self.root,
            text=f"Draw a digit (0-9)  -  model: {dataset_type}  acc: {accuracy:.1%}",
            font=header_font, pady=6,
        ).pack()

        self.canvas = tk.Canvas(
            self.root,
            width=CANVAS_SIZE, height=CANVAS_SIZE,
            bg="white", cursor="crosshair",
            highlightthickness=2, highlightbackground="#444",
        )
        self.canvas.pack(padx=16, pady=(0, 6))
        self.canvas.bind("<ButtonPress-1>",  self._on_press)
        self.canvas.bind("<B1-Motion>",      self._on_drag)
        self.canvas.bind("<ButtonRelease-1>", self._on_release)

        # Big digit display
        self.result_var = tk.StringVar(value="-")
        tk.Label(
            self.root, textvariable=self.result_var,
            font=result_font, fg="#1a73e8", width=4,
        ).pack()

        self.conf_var = tk.StringVar(value="Draw above, then click Predict")
        tk.Label(
            self.root, textvariable=self.conf_var,
            font=label_font, fg="#555", pady=2,
        ).pack()

        # Top-3 bar
        self.top3_var = tk.StringVar(value="")
        tk.Label(
            self.root, textvariable=self.top3_var,
            font=label_font, fg="#888",
        ).pack(pady=(0, 4))

        btn_frame = tk.Frame(self.root, pady=8)
        btn_frame.pack()

        tk.Button(
            btn_frame, text="Predict", width=10, font=btn_font,
            bg="#1a73e8", fg="white", relief="flat",
            activebackground="#1558b0",
            command=self._predict,
        ).grid(row=0, column=0, padx=10)

        tk.Button(
            btn_frame, text="Clear", width=10, font=btn_font,
            bg="#e05a5a", fg="white", relief="flat",
            activebackground="#b03a3a",
            command=self._clear,
        ).grid(row=0, column=1, padx=10)

    # ------------------------------------------------------------------
    # Drawing callbacks - connected dots for smooth lines
    # ------------------------------------------------------------------

    def _on_press(self, event: tk.Event) -> None:
        self._last_xy = (event.x, event.y)
        self._paint_dot(event.x, event.y)

    def _on_drag(self, event: tk.Event) -> None:
        if self._last_xy:
            x0, y0 = self._last_xy
            x1, y1 = event.x, event.y
            # Fill intermediate dots for a smooth stroke
            dist = max(abs(x1 - x0), abs(y1 - y0))
            steps = max(1, dist // (PEN_WIDTH // 4))
            for i in range(steps + 1):
                t = i / steps
                xi = int(x0 + (x1 - x0) * t)
                yi = int(y0 + (y1 - y0) * t)
                self._paint_dot(xi, yi)
        self._last_xy = (event.x, event.y)

    def _on_release(self, _event: tk.Event) -> None:
        self._last_xy = None

    def _paint_dot(self, x: int, y: int) -> None:
        r = PEN_WIDTH // 2
        self.canvas.create_oval(
            x - r, y - r, x + r, y + r,
            fill="black", outline="black",
        )
        self.pil_draw.ellipse([x - r, y - r, x + r, y + r], fill=0)

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    def _predict(self) -> None:
        feat_flat = preprocess_drawing(self.pil_img)

        if feat_flat is None:
            self.conf_var.set("Canvas is empty - please draw a digit first.")
            return

        features   = scaler.transform(feat_flat.reshape(1, -1))
        predicted  = model.predict(features)[0]
        proba      = model.predict_proba(features)[0]
        confidence = proba[predicted] * 100

        self.result_var.set(str(predicted))
        self.conf_var.set(f"Confidence: {confidence:.1f}%")

        top3_idx  = np.argsort(proba)[::-1][:3]
        top3_text = "   ".join(
            f"{i}: {proba[i]*100:.0f}%" for i in top3_idx
        )
        self.top3_var.set(f"Top-3:  {top3_text}")

        print(f"Predicted: {predicted}  ({confidence:.1f}%)  |  Top-3: {top3_text}")

    # ------------------------------------------------------------------
    # Clear
    # ------------------------------------------------------------------

    def _clear(self) -> None:
        self.canvas.delete("all")
        self.pil_img  = Image.new("L", (CANVAS_SIZE, CANVAS_SIZE), color=255)
        self.pil_draw = ImageDraw.Draw(self.pil_img)
        self._last_xy = None
        self.result_var.set("-")
        self.conf_var.set("Draw above, then click Predict")
        self.top3_var.set("")


# ---------------------------------------------------------------------------
# 5. Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    root = tk.Tk()
    DigitRecognizerApp(root)
    root.mainloop()
