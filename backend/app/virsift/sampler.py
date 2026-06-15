import numpy as np
import pandas as pd


class AdaptiveBiologicalSampler:
    MICRO_MAX = 90
    SEASONAL_MAX = 270

    def calculate_lifespan_category(self, df: pd.DataFrame) -> str:
        if df.empty or "collection_date" not in df.columns:
            return "Seasonal"

        dates = pd.to_datetime(df["collection_date"], errors="coerce").dropna()
        if dates.empty:
            return "Seasonal"

        span_days = (dates.max() - dates.min()).days

        if span_days < self.MICRO_MAX:
            return "Micro"
        if span_days <= self.SEASONAL_MAX:
            return "Seasonal"
        return "Endemic"

    def apply_proportionality_rule(
        self, df: pd.DataFrame, category: str = None
    ) -> pd.DataFrame:
        if df.empty:
            return df

        if category is None:
            category = self.calculate_lifespan_category(df)

        if category == "Micro":
            return self._weekly_sentinel_sampling(df)
        if category == "Seasonal":
            return self._monthly_sentinel_sampling(df)
        return self._quarterly_or_wave_sampling(df)

    def _weekly_sentinel_sampling(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty or "collection_date" not in df.columns:
            return df

        df = df.copy()
        df["_week"] = (
            pd.to_datetime(df["collection_date"], errors="coerce")
            .dt.to_period("W")
        )

        group_cols = (
            ["sequence_hash", "_week"]
            if "sequence_hash" in df.columns
            else ["_week"]
        )

        result = (
            df.dropna(subset=["_week"])
              .sort_values("collection_date")
              .groupby(group_cols, sort=False, observed=True)
              .first()
              .reset_index()
              .drop(columns=["_week"])
        )
        return result

    def _monthly_sentinel_sampling(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty or "collection_date" not in df.columns:
            return df

        df = df.copy()
        df["_month"] = (
            pd.to_datetime(df["collection_date"], errors="coerce")
            .dt.to_period("M")
        )

        group_cols = (
            ["sequence_hash", "_month"]
            if "sequence_hash" in df.columns
            else ["_month"]
        )

        result = (
            df.dropna(subset=["_month"])
              .sort_values("collection_date")
              .groupby(group_cols, sort=False, observed=True)
              .first()
              .reset_index()
              .drop(columns=["_month"])
        )
        return result

    def _quarterly_or_wave_sampling(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df

        try:
            from app.virsift.peak_detector import EpiWaveDetector
            detector = EpiWaveDetector()
            wave_analysis = detector.detect_epi_waves(df)

            if wave_analysis["wave_count"] >= 2:
                return detector.extract_wave_representatives(df, wave_analysis)
        except Exception:
            pass

        if "collection_date" not in df.columns:
            return df

        df = df.copy()
        df["_quarter"] = (
            pd.to_datetime(df["collection_date"], errors="coerce")
            .dt.to_period("Q")
        )

        group_cols = (
            ["sequence_hash", "_quarter"]
            if "sequence_hash" in df.columns
            else ["_quarter"]
        )

        result = (
            df.dropna(subset=["_quarter"])
              .sort_values("collection_date")
              .groupby(group_cols, sort=False, observed=True)
              .first()
              .reset_index()
              .drop(columns=["_quarter"])
        )
        return result
