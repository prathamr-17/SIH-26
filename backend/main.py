"""
AI Network Threat Forecasting API

Features:
- Random Forest threat detection
- Model probabilities
- SHAP feature explanations
- Prediction history
- Dashboard statistics
- Latest prediction
- Local Qwen AI explanation
- Login authentication
- NSL-KDD simulated replay engine
- Attack sandbox / effect simulation (chat-triggered + standalone)

IMPORTANT:
The replay feature is a SIMULATED LIVE FEED using historical NSL-KDD
records. It is NOT live packet capture from the user's network.

The sandbox feature is a SIMULATED effect timeline derived from each
attack category's real feature signature. It does not run any actual
attack traffic.
"""

# ============================================================
# IMPORTS
# ============================================================

import os
from datetime import datetime
from functools import lru_cache

import joblib
import pandas as pd
import shap

from fastapi import (
    Depends,
    FastAPI,
    HTTPException
)

from fastapi.middleware.cors import CORSMiddleware

from fastapi.security import (
    HTTPAuthorizationCredentials
)

from pydantic import BaseModel

from backend.auth import (
    login_user,
    require_login,
    logout_user
)

from backend.replay_engine import (
    replay_engine
)

from sandbox_api import (
    router as sandbox_router,
    parse_sandbox_intent,
    build_sandbox_response
)

from fastapi.exceptions import HTTPException as StarletteHTTPException


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="AI Network Threat Forecasting API",
    version="2.1.0",
    description=(
        "Local AI-powered network threat forecasting, "
        "simulated NSL-KDD replay, and attack sandbox API."
    )
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ============================================================
# SANDBOX ROUTER
#
# Exposes GET /api/sandbox/{target} standalone, independent of
# the chat/AI flow. "target" can be a numeric alert id or an
# attack/category keyword (e.g. "DoS", "neptune").
# ============================================================

app.include_router(
    sandbox_router,
    prefix="/api",
    dependencies=[Depends(require_login)]
)


# ============================================================
# PROJECT PATH
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

DATASET_PATH = os.path.join(
    BASE_DIR,
    "KDDTrain+.txt"
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "attack_detector.pkl"
)

ENCODER_PATH = os.path.join(
    BASE_DIR,
    "encoders.pkl"
)


# ============================================================
# NSL-KDD COLUMNS
# ============================================================

COLUMNS = [
    "duration",
    "protocol_type",
    "service",
    "flag",
    "src_bytes",
    "dst_bytes",
    "land",
    "wrong_fragment",
    "urgent",
    "hot",
    "num_failed_logins",
    "logged_in",
    "num_compromised",
    "root_shell",
    "su_attempted",
    "num_root",
    "num_file_creations",
    "num_shells",
    "num_access_files",
    "num_outbound_cmds",
    "is_host_login",
    "is_guest_login",
    "count",
    "srv_count",
    "serror_rate",
    "srv_serror_rate",
    "rerror_rate",
    "srv_rerror_rate",
    "same_srv_rate",
    "diff_srv_rate",
    "srv_diff_host_rate",
    "dst_host_count",
    "dst_host_srv_count",
    "dst_host_same_srv_rate",
    "dst_host_diff_srv_rate",
    "dst_host_same_src_port_rate",
    "dst_host_srv_diff_host_rate",
    "dst_host_serror_rate",
    "dst_host_srv_serror_rate",
    "dst_host_rerror_rate",
    "dst_host_srv_rerror_rate",
    "label",
    "difficulty"
]


# ============================================================
# LOAD MODEL
# ============================================================

@lru_cache(maxsize=1)
def load_model():

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model not found: {MODEL_PATH}"
        )

    return joblib.load(
        MODEL_PATH
    )


# ============================================================
# LOAD ENCODERS
# ============================================================

@lru_cache(maxsize=1)
def load_encoders():

    if not os.path.exists(ENCODER_PATH):
        raise FileNotFoundError(
            f"Encoders not found: {ENCODER_PATH}"
        )

    return joblib.load(
        ENCODER_PATH
    )


# ============================================================
# LOAD DATASET
# ============================================================

@lru_cache(maxsize=1)
def load_dataset():

    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(
            f"Dataset not found: {DATASET_PATH}"
        )

    return pd.read_csv(
        DATASET_PATH,
        names=COLUMNS
    )


# ============================================================
# PREPARE MODEL FEATURES
# ============================================================

def prepare_features(
    df,
    encoders
):

    df = df.copy()

    categorical_columns = [
        "protocol_type",
        "service",
        "flag"
    ]

    for column in categorical_columns:

        encoder = encoders[column]

        df[column] = encoder.transform(
            df[column].astype(str)
        )

    X = df.drop(
        columns=[
            "label",
            "difficulty"
        ]
    )

    return X


# ============================================================
# SEVERITY
# ============================================================

def calculate_severity(
    prediction,
    confidence
):

    if prediction != "attack":
        return "LOW"

    if confidence >= 95:
        return "CRITICAL"

    if confidence >= 80:
        return "HIGH"

    if confidence >= 60:
        return "MEDIUM"

    return "LOW"


# ============================================================
# SHAP TOP FEATURES
# ============================================================

@lru_cache(maxsize=1)
def get_shap_explainer():

    model = load_model()

    return shap.TreeExplainer(
        model
    )


def get_top_features(
    model,
    X,
    row_index
):

    explainer = get_shap_explainer()

    row = X.iloc[
        [row_index]
    ]

    shap_values = explainer.shap_values(
        row
    )

    classes = list(
        model.classes_
    )

    attack_index = (
        classes.index("attack")
        if "attack" in classes
        else 0
    )

    # --------------------------------------------------------
    # Different SHAP versions return different structures.
    # --------------------------------------------------------

    if isinstance(
        shap_values,
        list
    ):

        contributions = (
            shap_values[
                attack_index
            ][0]
        )

    else:

        if len(shap_values.shape) == 3:

            contributions = (
                shap_values[
                    0,
                    :,
                    attack_index
                ]
            )

        else:

            contributions = (
                shap_values[0]
            )

    importance = pd.Series(
        contributions,
        index=X.columns
    )

    top_names = (
        importance
        .abs()
        .sort_values(
            ascending=False
        )
        .head(5)
        .index
    )

    result = {}

    for name in top_names:

        value = row[
            name
        ].iloc[0]

        if hasattr(
            value,
            "item"
        ):

            value = value.item()

        result[name] = value

    return result


# ============================================================
# GENERATE HISTORICAL PREDICTIONS
# ============================================================

def generate_predictions(
    limit=100
):

    model = load_model()

    encoders = load_encoders()

    df = load_dataset()

    df = df.head(
        limit
    ).copy()

    X = prepare_features(
        df,
        encoders
    )

    predictions = model.predict(
        X
    )

    probabilities = model.predict_proba(
        X
    )

    classes = list(
        model.classes_
    )

    if "attack" in classes:

        attack_index = classes.index(
            "attack"
        )

    else:

        attack_index = 0

    results = []

    now = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    for index in range(
        len(df)
    ):

        prediction = str(
            predictions[index]
        )

        confidence = round(
            float(
                max(
                    probabilities[index]
                ) * 100
            ),
            2
        )

        attack_probability = round(
            float(
                probabilities[index][
                    attack_index
                ] * 100
            ),
            2
        )

        results.append({

            "id":
                index + 1,

            "timestamp":
                now,

            "prediction":
                prediction,

            "confidence":
                confidence,

            "attack_probability":
                attack_probability,

            "severity":
                calculate_severity(
                    prediction,
                    confidence
                )
        })

    return results


# ============================================================
# GET ML SUMMARY FOR SPECIFIC RECORD
# ============================================================

def get_current_ml_summary(
    record_id=None
):

    model = load_model()

    encoders = load_encoders()

    df = load_dataset()

    total_rows = len(df)

    # --------------------------------------------------------
    # Select requested record.
    #
    # record_id 1 means first NSL-KDD row.
    #
    # If no record is provided, use the last row to preserve
    # compatibility with the old AI endpoint behavior.
    # --------------------------------------------------------

    if record_id is None:

        row_number = (
            total_rows - 1
        )

    else:

        try:

            row_number = (
                int(record_id) - 1
            )

        except (
            TypeError,
            ValueError
        ):

            raise ValueError(
                "record_id must be an integer."
            )

    if row_number < 0:

        raise ValueError(
            "record_id must be greater than 0."
        )

    if row_number >= total_rows:

        raise ValueError(
            f"record_id must be between "
            f"1 and {total_rows}."
        )

    X = prepare_features(
        df,
        encoders
    )

    row = X.iloc[
        [row_number]
    ]

    prediction = str(
        model.predict(
            row
        )[0]
    )

    probabilities = (
        model.predict_proba(
            row
        )[0]
    )

    classes = list(
        model.classes_
    )

    if "attack" in classes:

        attack_index = classes.index(
            "attack"
        )

        attack_probability = round(
            float(
                probabilities[
                    attack_index
                ] * 100
            ),
            2
        )

    else:

        attack_probability = 0.0

    confidence = round(
        float(
            max(probabilities) * 100
        ),
        2
    )

    top_features = {}

    if prediction == "attack":

        top_features = get_top_features(
            model,
            X,
            row_number
        )

    severity = calculate_severity(
        prediction,
        confidence
    )

    dataset_label = str(
        df.iloc[
            row_number
        ]["label"]
    )

    return {

        "record_id":
            row_number + 1,

        "prediction":
            prediction,

        "confidence":
            confidence,

        "attack_probability":
            attack_probability,

        "severity":
            severity,

        "top_features":
            top_features,

        "dataset_label":
            dataset_label
    }


# ============================================================
# REQUEST MODELS
# ============================================================

class LoginRequest(BaseModel):

    username: str

    password: str


class AIAnalyzeRequest(BaseModel):

    question: str

    record_id: int | None = None


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message":
            "Network Threat API is working",

        "version":
            "2.1.0",

        "feed_type":
            "SIMULATED LIVE FEED",

        "source":
            "NSL-KDD"
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    model_exists = os.path.exists(
        MODEL_PATH
    )

    encoder_exists = os.path.exists(
        ENCODER_PATH
    )

    dataset_exists = os.path.exists(
        DATASET_PATH
    )

    return {

        "status":
            "healthy"
            if (
                model_exists
                and encoder_exists
                and dataset_exists
            )
            else "degraded",

        "model":
            model_exists,

        "encoders":
            encoder_exists,

        "dataset":
            dataset_exists,

        "feed_type":
            "SIMULATED LIVE FEED"
    }


# ============================================================
# MODEL INFORMATION
# ============================================================

@app.get("/model-info")
def model_info(
    username: str = Depends(
        require_login
    )
):

    try:

        model = load_model()

        dataset = load_dataset()

        return {

            "model_type":
                type(model).__name__,

            "estimators":
                getattr(
                    model,
                    "n_estimators",
                    None
                ),

            "features":
                len(
                    getattr(
                        model,
                        "feature_names_in_",
                        []
                    )
                ),

            "classes":
                [
                    str(value)
                    for value in model.classes_
                ],

            "dataset":
                "NSL-KDD",

            "dataset_file":
                "KDDTrain+.txt",

            "dataset_rows":
                len(dataset),

            "explainability":
                "SHAP",

            "llm":
                "Qwen2.5-0.5B-Instruct",

            "mode":
                "LOCAL"
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# LOGIN
# ============================================================

@app.post("/login")
def login(
    request: LoginRequest
):

    token = login_user(
        request.username,
        request.password
    )

    if token is None:

        raise HTTPException(
            status_code=401,
            detail="Invalid username or password."
        )

    return {

        "message":
            "Login successful.",

        "token":
            token,

        "username":
            request.username
    }


# ============================================================
# LOGOUT
# ============================================================

@app.post("/logout")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(
        require_login
    )
):

    logout_user(
        credentials.credentials
    )

    return {
        "message":
            "Logout successful."
    }


# ============================================================
# HISTORICAL PREDICTIONS
# ============================================================

@app.get("/predictions")
def predictions(
    username: str = Depends(
        require_login
    )
):

    try:

        return generate_predictions(
            100
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# DASHBOARD STATISTICS
# ============================================================

@app.get("/stats")
def stats(
    username: str = Depends(
        require_login
    )
):

    try:

        data = generate_predictions(
            100
        )

        total = len(
            data
        )

        attacks = sum(
            item["prediction"] == "attack"
            for item in data
        )

        normal = sum(
            item["prediction"] == "normal"
            for item in data
        )

        attack_percentage = (

            round(
                attacks
                / total
                * 100,
                2
            )

            if total > 0

            else 0
        )

        critical = sum(
            item["severity"] == "CRITICAL"
            for item in data
        )

        high = sum(
            item["severity"] == "HIGH"
            for item in data
        )

        return {

            "total":
                total,

            "attacks":
                attacks,

            "normal":
                normal,

            "attack_percentage":
                attack_percentage,

            "critical":
                critical,

            "high":
                high
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# LATEST ML RESULT
# ============================================================

@app.get("/latest")
def latest(
    username: str = Depends(
        require_login
    )
):

    try:

        return get_current_ml_summary()

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# REPLAY STATUS
# ============================================================

@app.get("/replay/status")
def replay_status(
    username: str = Depends(
        require_login
    )
):

    try:

        return replay_engine.status()

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# REPLAY START
# ============================================================

@app.post("/replay/start")
def replay_start(
    username: str = Depends(
        require_login
    )
):

    try:

        return replay_engine.start()

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# REPLAY PAUSE
# ============================================================

@app.post("/replay/pause")
def replay_pause(
    username: str = Depends(
        require_login
    )
):

    try:

        return replay_engine.pause()

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# REPLAY RESET
# ============================================================

@app.post("/replay/reset")
def replay_reset(
    username: str = Depends(
        require_login
    )
):

    try:

        return replay_engine.reset()

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# REPLAY NEXT EVENT
# ============================================================

@app.post("/replay/next")
def replay_next(
    username: str = Depends(
        require_login
    )
):

    try:

        return replay_engine.next_record()

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# AI ANALYZE
#
# If the question matches a sandbox intent ("simulate 4821",
# "sandbox DoS", "demo neptune", "show effects of R2L"), this
# resolves and returns a sandbox timeline instead of running
# the normal SHAP + Qwen explanation flow.
#
# Every response now carries a "type" field so the frontend
# can tell "sandbox" apart from the normal "text" explanation.
# ============================================================

@app.post("/ai/analyze")
def analyze_with_ai(
    request: AIAnalyzeRequest,
    username: str = Depends(
        require_login
    )
):

    question = request.question.strip()

    if not question:

        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty."
        )

    # --------------------------------------------------------
    # 1. Check for a sandbox intent first.
    #
    # This never touches the ML model or the LLM: it is a
    # separate, clearly-labeled simulated timeline.
    # --------------------------------------------------------

    sandbox_target = parse_sandbox_intent(
        question
    )

    if sandbox_target:

        try:

            sandbox_data = build_sandbox_response(
                sandbox_target
            )

            return {

                "type":
                    "sandbox",

                "data":
                    sandbox_data.dict()
            }

        except (HTTPException, StarletteHTTPException):

            # Not a resolvable target (e.g. "simulate quickly")
            # -> fall through to the normal explanation flow.

            pass

    # --------------------------------------------------------
    # 2. Normal flow: obtain the exact ML record requested by
    # the frontend. The LLM receives this ML result only for
    # explanation. It does NOT make or modify the prediction.
    # --------------------------------------------------------

    try:

        summary = get_current_ml_summary(
            request.record_id
        )


        # ----------------------------------------------------
        # Load local Qwen only when AI analysis is requested.
        # ----------------------------------------------------

        from llm_explainer import (
            explain_prediction
        )


        # ----------------------------------------------------
        # Ask Qwen to explain the existing ML result.
        # ----------------------------------------------------

        answer = explain_prediction(
            summary,
            question
        )


        # ----------------------------------------------------
        # Return ML result separately from AI explanation.
        #
        # This makes the architecture explicit:
        #
        # Random Forest = decision
        # SHAP = evidence
        # Qwen = explanation
        # ----------------------------------------------------

        return {

            "type":
                "text",

            "record_id":
                summary["record_id"],

            "prediction":
                summary["prediction"],

            "confidence":
                summary["confidence"],

            "attack_probability":
                summary[
                    "attack_probability"
                ],

            "severity":
                summary["severity"],

            "top_features":
                summary["top_features"],

            "dataset_label":
                summary["dataset_label"],

            "answer":
                answer
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )