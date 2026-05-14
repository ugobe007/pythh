#!/usr/bin/env python3
"""
Demo: tokenize + POS-tag text, extract proper nouns (NNP), count top mentions.

Requires: pip install nltk
Data (once): nltk.download('punkt_tab'); nltk.download('averaged_perceptron_tagger_eng')

Place your book as scripts/corpus/hp1.txt or pass --path.
"""

from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path
import pprint

from nltk import pos_tag, word_tokenize


def _default_corpus_path() -> Path:
    return Path(__file__).resolve().parent / "corpus" / "hp1.txt"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def text_tokenize(book: str) -> list[str]:
    return word_tokenize(book)


def tagging(tokens: list[str]) -> list[tuple[str, str]]:
    return pos_tag(tokens)


def find_proper_nouns(tagged_text: list[tuple[str, str]]) -> list[str]:
    """Collect NNP tokens; merge consecutive NNP pairs into one phrase (lowercased)."""
    proper_nouns: list[str] = []
    i = 0
    n = len(tagged_text)
    while i < n:
        if tagged_text[i][1] == "NNP":
            if i + 1 < n and tagged_text[i + 1][1] == "NNP":
                proper_nouns.append(
                    tagged_text[i][0].lower() + " " + tagged_text[i + 1][0].lower()
                )
                i += 1
            else:
                proper_nouns.append(tagged_text[i][0].lower())
        i += 1
    return proper_nouns


def summarize_text(proper_nouns: list[str], top_num: int) -> dict[str, int]:
    return dict(Counter(proper_nouns).most_common(top_num))


def main() -> None:
    parser = argparse.ArgumentParser(description="Top proper nouns via NLTK POS tags.")
    parser.add_argument(
        "--path",
        type=Path,
        default=None,
        help=f"Text file to analyze (default: {_default_corpus_path()})",
    )
    parser.add_argument("--top", type=int, default=100, help="How many top counts to show.")
    args = parser.parse_args()
    path = args.path or _default_corpus_path()
    if not path.is_file():
        raise SystemExit(
            f"Missing corpus file: {path}\n"
            "Create it or pass --path /path/to/your.txt"
        )

    book = read_text(path)
    tokens = text_tokenize(book)
    tagged = tagging(tokens)
    nouns = find_proper_nouns(tagged)
    counts = summarize_text(nouns, args.top)

    pp = pprint.PrettyPrinter(indent=4)
    pp.pprint(counts)


if __name__ == "__main__":
    main()
