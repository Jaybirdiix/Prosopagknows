from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from insightface.app import FaceAnalysis
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
import numpy as np
import cv2, os, joblib

app = FastAPI()
DATA_DIR = os.path.join(os.path.dirname(__file__), "faces")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "clf.joblib")
os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)

face_app = FaceAnalysis(name="auraface", root="models", providers=["CPUExecutionProvider"])
face_app.prepare(ctx_id=0)  # CPU

clf = None
labels = None

def load_embeddings_from_faces():
  X, y = [], []
  if not os.path.exists(DATA_DIR):
    return np.array([]), np.array([])
  for role in os.listdir(DATA_DIR):
    role_dir = os.path.join(DATA_DIR, role)
    if not os.path.isdir(role_dir): continue
    for fn in os.listdir(role_dir):
      if not fn.lower().endswith((".jpg",".jpeg",".png")): continue
      img = cv2.imread(os.path.join(role_dir, fn))
      if img is None: continue
      faces = face_app.get(img)
      if len(faces) == 1:
        X.append(faces[0].normed_embedding)
        y.append(role)
  return np.array(X), np.array(y)

@app.post("/train")
def train():
  global clf, labels
  X, y = load_embeddings_from_faces()
  if len(X) < 2:
    return {"ok": False, "msg": "not enough data to train"}
  X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.05, random_state=42)
  clf = LogisticRegression(max_iter=1000).fit(X_train, y_train)
  acc = float(clf.score(X_test, y_test)) if len(X_test) > 0 else None
  joblib.dump({"clf": clf}, MODEL_PATH)
  labels = sorted(set(y))
  return {"ok": True, "acc": acc, "classes": labels}

@app.post("/predict")
async def predict(image: UploadFile = File(...)):
  global clf
  if clf is None:
    if os.path.exists(MODEL_PATH):
      clf = joblib.load(MODEL_PATH)["clf"]
    else:
      return {"ok": False, "msg": "model not trained"}
  raw = await image.read()
  npimg = np.frombuffer(raw, np.uint8)
  img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
  faces = face_app.get(img)
  results = []
  for f in faces:
    embedding = f.normed_embedding
    name = clf.predict([embedding])[0]
    x1,y1,x2,y2 = map(int, f.bbox)
    results.append({"name": name, "box": [x1,y1,x2,y2]})
  return {"ok": True, "results": results}
