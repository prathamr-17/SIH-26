"""
AI Network Threat Forecasting System
-------------------------------------
Historical NSL-KDD Replay Engine

Purpose:
- Replays NSL-KDD records one by one.
- Uses the existing trained Random Forest model.
- Uses the existing encoders.
- Produces prediction, confidence, attack probability and severity.
- Keeps replay state in memory.
- This is a SIMULATED LIVE FEED, not real network traffic.
"""

import os
import threading
from datetime import datetime

import joblib
import pandas as pd


# ============================================================
# PROJECT PATHS
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
# REPLAY ENGINE
# ============================================================

class ReplayEngine:

    def __init__(self):
        self.lock = threading.Lock()

        self.model = None
        self.encoders = None
        self.dataset = None
        self.features = None

        self.cursor = 0
        self.running = False
        self.generated_count = 0

        self.last_event = None

        self._load_resources()


    # ========================================================
    # LOAD MODEL / ENCODERS / DATASET
    # ========================================================

    def _load_resources(self):

        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Model not found: {MODEL_PATH}"
            )

        if not os.path.exists(ENCODER_PATH):
            raise FileNotFoundError(
                f"Encoders not found: {ENCODER_PATH}"
            )

        if not os.path.exists(DATASET_PATH):
            raise FileNotFoundError(
                f"Dataset not found: {DATASET_PATH}"
            )

        self.model = joblib.load(
            MODEL_PATH
        )

        self.encoders = joblib.load(
            ENCODER_PATH
        )

        self.dataset = pd.read_csv(
            DATASET_PATH,
            names=COLUMNS
        )

        self.features = self._prepare_features(
            self.dataset
        )


    # ========================================================
    # PREPARE FEATURES
    # ========================================================

    def _prepare_features(self, df):

        df = df.copy()

        categorical_columns = [
            "protocol_type",
            "service",
            "flag"
        ]

        for column in categorical_columns:

            encoder = self.encoders[column]

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


    # ========================================================
    # SEVERITY
    # ========================================================

    @staticmethod
    def _calculate_severity(
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


    # ========================================================
    # START REPLAY
    # ========================================================

    def start(self):

        with self.lock:

            self.running = True

            return self.status()


    # ========================================================
    # PAUSE REPLAY
    # ========================================================

    def pause(self):

        with self.lock:

            self.running = False

            return self.status()


    # ========================================================
    # RESET REPLAY
    # ========================================================

    def reset(self):

        with self.lock:

            self.cursor = 0

            self.running = False

            self.generated_count = 0

            self.last_event = None

            return self.status()


    # ========================================================
    # GET NEXT RECORD
    # ========================================================

    def next_record(self):

        with self.lock:

            # ------------------------------------------------
            # Check whether replay has been started
            # ------------------------------------------------

            if not self.running:

                return {
                    "status": "paused",
                    "message": "Replay is paused.",
                    "event": None,
                    "replay": self.status()
                }


            # ------------------------------------------------
            # Check end of dataset
            # ------------------------------------------------

            if self.cursor >= len(self.dataset):

                self.running = False

                return {
                    "status": "completed",
                    "message": "Replay reached the end of the dataset.",
                    "event": None,
                    "replay": self.status()
                }


            # ------------------------------------------------
            # Select exactly one record
            # ------------------------------------------------

            row_index = self.cursor

            row = self.features.iloc[
                [row_index]
            ]


            # ------------------------------------------------
            # Prediction
            # ------------------------------------------------

            prediction = str(
                self.model.predict(
                    row
                )[0]
            )


            # ------------------------------------------------
            # Probability
            # ------------------------------------------------

            probabilities = (
                self.model.predict_proba(
                    row
                )[0]
            )


            classes = list(
                self.model.classes_
            )


            # ------------------------------------------------
            # Find attack probability
            # ------------------------------------------------

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


            # ------------------------------------------------
            # Confidence
            # ------------------------------------------------

            confidence = round(
                float(
                    max(probabilities) * 100
                ),
                2
            )


            # ------------------------------------------------
            # Severity
            # ------------------------------------------------

            severity = (
                self._calculate_severity(
                    prediction,
                    confidence
                )
            )


            # ------------------------------------------------
            # Original dataset label
            #
            # This is useful for evaluation/demo only.
            # It does NOT override the ML prediction.
            # ------------------------------------------------

            original_label = str(
                self.dataset.iloc[
                    row_index
                ]["label"]
            )


            # ------------------------------------------------
            # Timestamp
            #
            # This timestamp represents replay time.
            # It is NOT the actual capture timestamp.
            # ------------------------------------------------

            timestamp = (
                datetime.now().strftime(
                    "%Y-%m-%d %H:%M:%S"
                )
            )


            # ------------------------------------------------
            # Event object
            # ------------------------------------------------

            event = {

                "id":
                    row_index + 1,

                "timestamp":
                    timestamp,

                "prediction":
                    prediction,

                "confidence":
                    confidence,

                "attack_probability":
                    attack_probability,

                "severity":
                    severity,

                "replay_record":
                    row_index + 1,

                "dataset_label":
                    original_label
            }


            # ------------------------------------------------
            # Move cursor
            # ------------------------------------------------

            self.cursor += 1

            self.generated_count += 1

            self.last_event = event


            # ------------------------------------------------
            # Return event
            # ------------------------------------------------

            return {

                "status": "event",

                "message":
                    "Replay event generated.",

                "event":
                    event,

                "replay":
                    self.status()
            }


    # ========================================================
    # STATUS
    # ========================================================

    def status(self):

        total_records = (
            len(self.dataset)
            if self.dataset is not None
            else 0
        )

        current_record = (
            self.cursor
            if self.cursor <= total_records
            else total_records
        )

        progress = (
            round(
                current_record
                / total_records
                * 100,
                2
            )
            if total_records > 0
            else 0
        )

        return {

            "running":
                self.running,

            "current_record":
                current_record,

            "total_records":
                total_records,

            "generated_count":
                self.generated_count,

            "progress":
                progress,

            "remaining":
                max(
                    total_records
                    - current_record,
                    0
                ),

            "last_event":
                self.last_event,

            "feed_type":
                "SIMULATED LIVE FEED",

            "source":
                "NSL-KDD KDDTrain+.txt"
        }


# ============================================================
# SINGLE GLOBAL ENGINE INSTANCE
# ============================================================

replay_engine = ReplayEngine()
