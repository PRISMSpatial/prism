import numpy as np
import pandas as pd


class EpiWaveDetector:
    def detect_epi_waves(
        self,
        df: pd.DataFrame,
        sensitivity: float = 0.5,
        min_peak_height: int = 5,
    ) -> dict:
        from scipy.signal import find_peaks

        ts = self._build_weekly_counts(df)
        if ts.empty or len(ts) < 3:
            return {"peaks": [], "troughs": [], "wave_count": 0, "ts": ts}

        counts = ts.values.astype(float)
        median_count = float(np.median(counts[counts > 0])) if counts.any() else 1.0
        prominence = max(1.0, sensitivity * median_count)

        peak_indices, _ = find_peaks(
            counts,
            height=min_peak_height,
            prominence=prominence,
            distance=2,
        )

        trough_indices = self._find_troughs_between_peaks(
            pd.Series(counts), peak_indices
        )

        periods = ts.index.astype(str).tolist()

        peaks = [(periods[i], int(counts[i])) for i in peak_indices]
        troughs = [(periods[i], int(counts[i])) for i in trough_indices]

        return {
            "peaks": peaks,
            "troughs": troughs,
            "wave_count": len(peaks),
            "ts": ts,
        }

    def detect_candidate_peaks(
        self, df: pd.DataFrame, sensitivity: float = 0.5
    ) -> list:
        wave_analysis = self.detect_epi_waves(df, sensitivity=sensitivity)
        candidates = []

        sorted_peaks = sorted(wave_analysis["peaks"], key=lambda x: x[1], reverse=True)
        for rank, (period, count) in enumerate(sorted_peaks, start=1):
            candidates.append({
                "date": period,
                "count": count,
                "type": "Major Peak",
                "rank": rank,
            })

        for period, count in wave_analysis["troughs"]:
            candidates.append({
                "date": period,
                "count": count,
                "type": "Wave Trough",
                "rank": None,
            })

        for cluster in self._detect_off_season_clusters(df):
            candidates.append(cluster)

        candidates.sort(key=lambda x: x["date"])
        return candidates

    def extract_wave_representatives(
        self, df: pd.DataFrame, wave_analysis: dict
    ) -> pd.DataFrame:
        if df.empty or "collection_date" not in df.columns:
            return df.head(0)

        df = df.copy()
        df["_period"] = (
            pd.to_datetime(df["collection_date"], errors="coerce")
            .dt.to_period("W")
            .astype(str)
        )

        selected_periods = set()
        for period, _ in wave_analysis.get("peaks", []):
            selected_periods.add(period)
        for period, _ in wave_analysis.get("troughs", []):
            selected_periods.add(period)

        reps = []

        valid = df.dropna(subset=["collection_date"])
        if not valid.empty:
            reps.append(valid.iloc[0])
            if len(valid) > 1:
                reps.append(valid.iloc[-1])

        for period in selected_periods:
            subset = df[df["_period"] == period]
            if not subset.empty:
                reps.append(subset.iloc[0])

        if not reps:
            return df.head(0)

        result = pd.DataFrame(reps).drop(columns=["_period"], errors="ignore")
        return result.drop_duplicates(
            subset=["sequence_hash"] if "sequence_hash" in result.columns else None
        ).reset_index(drop=True)

    def _build_weekly_counts(self, df: pd.DataFrame) -> pd.Series:
        if df.empty or "collection_date" not in df.columns:
            return pd.Series(dtype=int)

        dates = pd.to_datetime(df["collection_date"], errors="coerce").dropna()
        if dates.empty:
            return pd.Series(dtype=int)

        week_periods = dates.dt.to_period("W")
        counts = week_periods.value_counts().sort_index()
        counts.index = counts.index.astype(str)
        return counts

    def _find_troughs_between_peaks(
        self, temporal_counts: pd.Series, peaks: np.ndarray
    ) -> np.ndarray:
        if len(peaks) < 2:
            return np.array([], dtype=int)

        troughs = []
        for i in range(len(peaks) - 1):
            start, end = peaks[i], peaks[i + 1]
            segment = temporal_counts.iloc[start:end + 1]
            if len(segment) > 2:
                local_min_offset = int(segment.iloc[1:-1].values.argmin()) + 1
                troughs.append(start + local_min_offset)

        return np.array(troughs, dtype=int)

    def _detect_off_season_clusters(self, df: pd.DataFrame) -> list:
        if df.empty or "collection_date" not in df.columns:
            return []

        dates = pd.to_datetime(df["collection_date"], errors="coerce").dropna()
        if dates.empty:
            return []

        monthly = dates.dt.to_period("M").value_counts().sort_index()
        if len(monthly) < 4:
            return []

        q1 = float(monthly.quantile(0.25))
        q3 = float(monthly.quantile(0.75))
        iqr = q3 - q1
        low_threshold = max(1, q1 - 1.5 * iqr)

        clusters = []
        for period, count in monthly.items():
            if 0 < count <= low_threshold:
                clusters.append({
                    "date": str(period),
                    "count": int(count),
                    "type": "Off-Season Cluster",
                    "rank": None,
                })
        return clusters
