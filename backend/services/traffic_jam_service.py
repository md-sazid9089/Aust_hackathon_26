"""
Traffic Jam Service
===================
Generates dummy hourly road-traffic dataset, trains a classifier,
and returns route-level traffic-jam percentage.
"""

from __future__ import annotations

import csv
import hashlib
import math
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sqlalchemy.orm import Session

from database import SessionLocal
from models.traffic_models import RoadTrafficObservation


@dataclass
class EdgeContext:
    edge_id: str
    road_type: str
    length_m: float


class TrafficJamService:
    """Dummy dataset + ML training + route risk inference."""

    def __init__(self):
        self._model: RandomForestClassifier | None = None
        self._road_type_code: dict[str, int] = {}
        self._jam_lookup: dict[tuple[str, int], int] = {}
        self._csv_path: Path | None = None

    def initialize_from_graph(self, graph) -> None:
        """Ensure dataset exists, train from CSV, and build lookup cache."""
        if graph is None:
            return

        with SessionLocal() as db:
            expected_rows = graph.number_of_edges() * 24
            existing_rows = db.query(RoadTrafficObservation).count()
            if existing_rows < expected_rows:
                self._regenerate_dataset(db, graph)

            csv_path = self._ensure_dataset_csv(db)

        if csv_path is None:
            self._model = None
            self._jam_lookup = {}
            return

        self._csv_path = csv_path
        self._train_from_csv(csv_path)
        self._load_jam_lookup_from_csv(csv_path)

    def predict_route_jam(self, edge_contexts: list[dict], hour_of_day: int | None = None) -> dict | None:
        """Predict combined traffic-jam percentage for route edges at a given hour."""
        if not edge_contexts:
            return None

        if self._model is None:
            if self._csv_path is not None:
                self._train_from_csv(self._csv_path)
                self._load_jam_lookup_from_csv(self._csv_path)
            if self._model is None:
                return None

        hour = int(datetime.now().hour if hour_of_day is None else hour_of_day) % 24

        analyzed = 0
        heavy = 0
        moderate = 0
        low = 0
        edge_prob_sum = 0.0

        for edge in edge_contexts:
            edge_id = str(edge.get("edge_id") or "")
            if not edge_id:
                continue

            road_type = str(edge.get("road_type") or "unknown")
            length_m = float(edge.get("length_m") or 0.0)
            jam_level = self._jam_lookup.get((edge_id, hour))
            if jam_level is None:
                jam_level = self._dummy_level(edge_id, road_type, hour)

            if jam_level >= 3:
                heavy += 1
            elif jam_level == 2:
                moderate += 1
            else:
                low += 1

            features = np.array(
                [[
                    float(hour),
                    float(self._edge_hash(edge_id)),
                    float(self._road_type_to_code(road_type)),
                    float(self._length_bucket(length_m)),
                ]]
            )
            class_probs = self._model.predict_proba(features)[0]
            classes = list(self._model.classes_)
            prob_mod = class_probs[classes.index(2)] if 2 in classes else 0.0
            prob_heavy = class_probs[classes.index(3)] if 3 in classes else 0.0
            model_jam_prob = float(prob_mod + prob_heavy)

            level_factor = {1: 0.25, 2: 0.60, 3: 0.90}.get(jam_level, 0.50)
            edge_jam_prob = 0.5 * model_jam_prob + 0.5 * level_factor
            edge_jam_prob = max(0.01, min(0.99, edge_jam_prob))

            edge_prob_sum += edge_jam_prob
            analyzed += 1

        if analyzed == 0:
            return None

        route_jam_prob = edge_prob_sum / float(analyzed)
        confidence = min(1.0, 0.60 + 0.40 * (analyzed / max(4.0, analyzed)))

        return {
            "hour_of_day": hour,
            "route_jam_chance_pct": round(route_jam_prob * 100.0, 2),
            "edges_analyzed": analyzed,
            "heavy_edges": heavy,
            "moderate_edges": moderate,
            "low_edges": low,
            "confidence": round(confidence, 3),
        }

    def _regenerate_dataset(self, db: Session, graph) -> None:
        """Build a complete per-road, per-hour dummy dataset and persist to DB + CSV."""
        db.query(RoadTrafficObservation).delete()
        db.commit()

        rows: list[RoadTrafficObservation] = []
        csv_rows: list[list[str | int | float]] = []

        for u, v, key, data in graph.edges(keys=True, data=True):
            edge_id = f"{u}->{v}:{key}"
            road_type = self._road_type(data)
            length_m = float(data.get("length") or 0.0)

            for hour in range(24):
                level = self._dummy_level(edge_id, road_type, hour)
                label = {1: "low", 2: "moderate", 3: "heavy"}[level]

                rows.append(
                    RoadTrafficObservation(
                        edge_id=edge_id,
                        road_type=road_type,
                        length_m=length_m,
                        hour_of_day=hour,
                        jam_level=level,
                        jam_label=label,
                    )
                )
                csv_rows.append([edge_id, road_type, round(length_m, 3), hour, level, label])

        db.bulk_save_objects(rows)
        db.commit()
        self._write_csv(csv_rows)

    def _ensure_dataset_csv(self, db: Session) -> Path | None:
        """Return a dataset CSV path; export from DB if a local CSV does not already exist."""
        existing = self._find_existing_csv()
        if existing is not None:
            return existing

        records = db.query(RoadTrafficObservation).all()
        if not records:
            return None

        csv_rows = [
            [
                rec.edge_id,
                rec.road_type,
                round(float(rec.length_m), 3),
                int(rec.hour_of_day),
                int(rec.jam_level),
                rec.jam_label,
            ]
            for rec in records
        ]
        return self._write_csv(csv_rows)

    def _train_from_csv(self, csv_path: Path) -> None:
        """Train a 3-class classifier (Low/Moderate/Heavy) from dataset CSV."""
        if not csv_path.exists():
            self._model = None
            return

        df = pd.read_csv(csv_path)
        if df.empty:
            self._model = None
            return

        x = np.column_stack(
            [
                df["hour_of_day"].astype(float).to_numpy(),
                df["edge_id"].astype(str).map(self._edge_hash).astype(float).to_numpy(),
                df["road_type"].astype(str).map(self._road_type_to_code).astype(float).to_numpy(),
                df["length_m"].astype(float).map(self._length_bucket).astype(float).to_numpy(),
            ]
        )
        y = df["jam_level"].astype(int).to_numpy()

        model = RandomForestClassifier(
            n_estimators=180,
            max_depth=14,
            min_samples_split=4,
            random_state=42,
            n_jobs=-1,
        )
        model.fit(x, y)
        self._model = model

    def _load_jam_lookup_from_csv(self, csv_path: Path) -> None:
        """Cache jam levels from CSV keyed by (edge_id, hour)."""
        self._jam_lookup = {}
        if not csv_path.exists():
            return

        df = pd.read_csv(csv_path, usecols=["edge_id", "hour_of_day", "jam_level"])
        for row in df.itertuples(index=False):
            self._jam_lookup[(str(row.edge_id), int(row.hour_of_day))] = int(row.jam_level)

    def _road_type(self, edge_data: dict) -> str:
        road = edge_data.get("road_type") or edge_data.get("highway") or "unknown"
        if isinstance(road, (list, tuple)):
            return str(road[0]) if road else "unknown"
        return str(road)

    def _dummy_level(self, edge_id: str, road_type: str, hour: int) -> int:
        """Generate deterministic dummy level (1/2/3) with rush-hour bias."""
        seed = self._stable_int(f"{edge_id}:{road_type}:{hour}") % 100

        if 7 <= hour <= 10 or 17 <= hour <= 20:
            if seed < 50:
                return 3
            if seed < 85:
                return 2
            return 1

        if 11 <= hour <= 16:
            if seed < 25:
                return 3
            if seed < 70:
                return 2
            return 1

        if seed < 12:
            return 3
        if seed < 48:
            return 2
        return 1

    def _dataset_candidates(self) -> list[Path]:
        return [
            Path(__file__).resolve().parents[1] / "data" / "traffic_dummy_dataset.csv",
            Path("/app/data/osm_cache/traffic_dummy_dataset.csv"),
            Path("/tmp/traffic_dummy_dataset.csv"),
        ]

    def _find_existing_csv(self) -> Path | None:
        for path in self._dataset_candidates():
            if path.exists() and path.stat().st_size > 0:
                return path
        return None

    def _write_csv(self, rows: list[list[str | int | float]]) -> Path | None:
        candidate_paths = self._dataset_candidates()

        for csv_path in candidate_paths:
            try:
                csv_path.parent.mkdir(parents=True, exist_ok=True)
                with csv_path.open("w", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    writer.writerow(["edge_id", "road_type", "length_m", "hour_of_day", "jam_level", "jam_label"])
                    writer.writerows(rows)
                return csv_path
            except PermissionError:
                continue

        return None

    def _edge_hash(self, edge_id: str) -> int:
        return self._stable_int(edge_id) % 10000

    def _road_type_to_code(self, road_type: str) -> int:
        key = road_type or "unknown"
        if key not in self._road_type_code:
            self._road_type_code[key] = len(self._road_type_code) + 1
        return self._road_type_code[key]

    def _length_bucket(self, length_m: float) -> int:
        return int(max(0.0, min(1000.0, math.floor(length_m / 25.0))))

    def _stable_int(self, text: str) -> int:
        return int(hashlib.md5(text.encode("utf-8")).hexdigest()[:12], 16)


traffic_jam_service = TrafficJamService()
