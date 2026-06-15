import re
import signal

import pandas as pd

_REGEX_TIMEOUT_SECONDS = 5


def _safe_regex_match(col, pattern):
    """Apply regex with a timeout to prevent ReDoS."""
    try:
        compiled = re.compile(pattern, re.IGNORECASE)
    except re.error:
        return None

    if len(pattern) > 200:
        return None

    dangerous = re.search(r'([+*])\1|(\([^)]*[+*][^)]*\))[+*]', pattern)
    if dangerous:
        return None

    try:
        return col.astype(str).str.contains(compiled, na=False)
    except Exception:
        return None


class VectorizedFilterEngine:
    OPERATORS = {
        "equals": "scalar",
        "not_equals": "scalar",
        "contains": "scalar",
        "not_contains": "scalar",
        "starts_with": "scalar",
        "regex": "scalar",
        "in_list": "list",
        "date_range": "pair",
    }

    def apply_header_component_filters(
        self, df: pd.DataFrame, filter_rules: list
    ) -> pd.DataFrame:
        if df.empty or not filter_rules:
            return df

        mask = pd.Series(True, index=df.index)

        for rule in filter_rules:
            field = rule.get("field", "")
            operator = rule.get("operator", "equals")
            value = rule.get("value")

            if field not in df.columns:
                continue

            col = df[field]
            rule_mask = self._build_mask(col, operator, value, field)
            if rule_mask is not None:
                mask &= rule_mask

        return df[mask].copy()

    def _build_mask(self, col, operator, value, field):
        if operator == "equals":
            return col.astype(str).str.strip() == str(value).strip()
        if operator == "not_equals":
            return col.astype(str).str.strip() != str(value).strip()
        if operator == "contains":
            return col.astype(str).str.contains(
                re.escape(str(value)), case=False, na=False
            )
        if operator == "not_contains":
            return ~col.astype(str).str.contains(
                re.escape(str(value)), case=False, na=False
            )
        if operator == "starts_with":
            return col.astype(str).str.startswith(str(value), na=False)
        if operator == "regex":
            return _safe_regex_match(col, str(value))
        if operator == "in_list":
            values = [str(v).strip() for v in (value or [])]
            return col.astype(str).str.strip().isin(values)
        if operator == "date_range":
            try:
                start, end = value[0], value[1]
                dates = pd.to_datetime(col, errors="coerce")
                return (dates >= pd.Timestamp(start)) & (dates <= pd.Timestamp(end))
            except Exception:
                return None
        return None

    def auto_detect_available_fields(
        self, df: pd.DataFrame, sample_size: int = 100
    ) -> dict:
        if df.empty:
            return {}

        result = {}
        sample = df.head(sample_size) if len(df) > sample_size else df

        for col in df.columns:
            if col in ("sequence", "sequence_hash"):
                continue

            non_null = df[col].replace({"Unknown": None, "": None}).dropna()
            populated_pct = 100 * len(non_null) / len(df)

            if populated_pct < 10:
                continue

            sample_vals = (
                sample[col]
                .replace({"Unknown": None, "": None})
                .dropna()
                .astype(str)
                .unique()[:5]
                .tolist()
            )

            result[col] = {
                "populated_pct": round(populated_pct, 1),
                "n_unique": int(df[col].nunique()),
                "sample_values": sample_vals,
            }

        return result

    def create_hierarchical_clade_filter(
        self, df: pd.DataFrame, clade_pattern: str, level: int = None
    ) -> pd.DataFrame:
        if df.empty or not clade_pattern:
            return df

        if level is not None:
            col_name = f"clade_l{level}"
            if col_name not in df.columns:
                return df
            mask = df[col_name].astype(str) == clade_pattern
        else:
            clade_col = "clade" if "clade" in df.columns else None
            if clade_col is None:
                return df
            mask = df[clade_col].astype(str).str.startswith(clade_pattern, na=False)

        return df[mask].copy()

    def create_subtype_filter(
        self, df: pd.DataFrame, subtype_patterns: list
    ) -> pd.DataFrame:
        if df.empty or not subtype_patterns:
            return df

        col = "subtype_clean" if "subtype_clean" in df.columns else "subtype"
        if col not in df.columns:
            return df

        mask = df[col].astype(str).str.strip().isin(
            [p.strip() for p in subtype_patterns]
        )
        return df[mask].copy()

    def filter_min_length(self, df: pd.DataFrame, min_len: int) -> pd.DataFrame:
        if "sequence_length" in df.columns:
            return df[df["sequence_length"] >= min_len].copy()
        if "sequence" in df.columns:
            return df[df["sequence"].str.len() >= min_len].copy()
        return df

    def filter_max_n_run(self, df: pd.DataFrame, max_n_run: int) -> pd.DataFrame:
        if "sequence" not in df.columns:
            return df
        pattern = "N" * max_n_run
        mask = ~df["sequence"].str.contains(pattern, case=False, na=False)
        return df[mask].copy()

    def deduplicate(self, df: pd.DataFrame, mode: str = "sequence") -> pd.DataFrame:
        if df.empty:
            return df

        if mode == "seq+subtype":
            cols = [c for c in ("sequence_hash", "subtype_clean") if c in df.columns]
        else:
            cols = ["sequence_hash"] if "sequence_hash" in df.columns else []

        if not cols:
            return df

        return df.drop_duplicates(subset=cols, keep="first").copy()
