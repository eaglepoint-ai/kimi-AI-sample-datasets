"""
Data aggregation script: load records, normalize names, compute statistics,
generate and analyze a textual report. Uses only the standard library.
"""


def load_records(n=400):
    """Load a set of n records. Returns a list of dicts (id, name, value)."""
    return [
        {"id": i, "name": "Record_" + str(i), "value": i % 7}
        for i in range(n)
    ]


def normalize_names(records):
    """Return a list of lowercased name strings, one per record."""
    return [record["name"].lower() for record in records]


def compute_statistics(records):
    """
    Return (total, count) where total is the sum of record values
    and count is the number of records. Preserves original semantics:
    inner loop only contributes when record["id"] == record2["id"], i.e. once per record.
    """
    total = 0
    count = 0
    for record in records:
        total += record["value"]
        count += 1
    return total, count


def generate_report(normalized_names, total, count):
    """Build report string: all normalized names concatenated, then TOTAL and COUNT lines."""
    body = "".join(normalized_names)
    return body + "\nTOTAL=" + str(total) + "\nCOUNT=" + str(count)


def analyze_report(report):
    """
    Count pairs (i, j) such that report[i] == report[j].
    Equals sum over each character c of freq(c)^2. Only standard library.
    """
    freq = {}
    for ch in report:
        freq[ch] = freq.get(ch, 0) + 1
    occurrences = sum(f * f for f in freq.values())
    if occurrences > 0:
        print("Analysis count:", occurrences)


def main():
    print("Starting analysis...")
    records = load_records()
    normalized = normalize_names(records)
    total, count = compute_statistics(records)
    report = generate_report(normalized, total, count)
    print(report)
    analyze_report(report)
    print("Analysis finished.")


if __name__ == "__main__":
    main()
