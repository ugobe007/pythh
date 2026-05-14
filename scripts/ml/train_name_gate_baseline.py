#!/usr/bin/env python3
"""
Baseline classifier: char n-gram + logistic regression on exported CSV.

Dependencies:
  pip install pandas scikit-learn

Usage:
  python scripts/ml/train_name_gate_baseline.py scripts/ml/exports/your_export.csv

Labels:
  - junk = positive class for "is junk" (match training_label == junk)
  - clean = negative
  - ambiguous = excluded by default (enrichment outcomes without definitive junk/clean)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("csv_path", type=Path)
    p.add_argument("--include-ambiguous", action="store_true", help="Map ambiguous→0 (not junk)")
    args = p.parse_args()

    df = pd.read_csv(args.csv_path)
    if "name" not in df.columns or "training_label" not in df.columns:
        print("CSV must have columns: name, training_label", file=sys.stderr)
        sys.exit(1)

    df = df.dropna(subset=["name"])
    y_raw = df["training_label"].astype(str).str.lower()

    if args.include_ambiguous:
        y = (y_raw == "junk").astype(int)
        mask = y_raw.isin(["junk", "clean", "ambiguous"])
    else:
        mask = y_raw.isin(["junk", "clean"])
        y = (y_raw[mask] == "junk").astype(int)
        df = df.loc[mask]

    if len(df) < 50:
        print(f"Need at least 50 labeled rows; got {len(df)}. Log more with --ml-log.", file=sys.stderr)
        sys.exit(1)

    X = df["name"].astype(str)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    pipe = Pipeline(
        [
            (
                "vec",
                CountVectorizer(
                    analyzer="char_wb",
                    ngram_range=(2, 5),
                    min_df=2,
                    max_features=50000,
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    class_weight="balanced",
                    max_iter=2000,
                    solver="saga",
                ),
            ),
        ]
    )
    pipe.fit(X_train, y_train)
    pred = pipe.predict(X_test)
    proba = pipe.predict_proba(X_test)[:, 1]

    print(classification_report(y_test, pred, digits=3))
    if len(np.unique(y_test)) > 1:
        print(f"ROC-AUC: {roc_auc_score(y_test, proba):.4f}")

    # Top coefficients (approximate interpretability)
    vec = pipe.named_steps["vec"]
    clf = pipe.named_steps["clf"]
    feats = np.array(vec.get_feature_names_out())
    coef = clf.coef_.ravel()
    top_junk = np.argsort(coef)[-25:][::-1]
    top_clean = np.argsort(coef)[:25]
    print("\nTop n-grams toward JUNK:")
    for i in top_junk:
        print(f"  {feats[i]:30} {coef[i]:+.4f}")
    print("\nTop n-grams toward CLEAN:")
    for i in top_clean:
        print(f"  {feats[i]:30} {coef[i]:+.4f}")


if __name__ == "__main__":
    main()
