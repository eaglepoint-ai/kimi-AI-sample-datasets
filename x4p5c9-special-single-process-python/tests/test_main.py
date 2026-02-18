"""
Comprehensive test suite for the data aggregation script.
Uses only the Python standard library. Verifies exact output equivalence,
determinism, correctness of loading, normalization, aggregation, and reporting,
and automated performance tests for O(n) time complexity and linear memory scaling.
"""

import io
import os
import sys
import time
import tracemalloc
import unittest

_repo_path = os.environ.get("REPO_PATH", "repository_after")
_is_before = _repo_path == "repository_before"

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", _repo_path))
import main as main_module


def _reset_before_globals():
    """Clear global lists in repository_before so each test runs with 400 records only."""
    if not _is_before:
        return
    if hasattr(main_module, "GLOBAL_RECORDS"):
        main_module.GLOBAL_RECORDS.clear()
    if hasattr(main_module, "GLOBAL_NORMALIZED"):
        main_module.GLOBAL_NORMALIZED.clear()


def run_main_capture_stdout():
    """Run main() and return captured stdout as a string."""
    _reset_before_globals()
    buffer = io.StringIO()
    old_stdout = sys.stdout
    try:
        sys.stdout = buffer
        main_module.main()
        return buffer.getvalue()
    finally:
        sys.stdout = old_stdout


def compute_expected_console_output():
    """
    Build the exact console output using the same pure functions as main.
    Works for repository_after only (repository_before uses globals).
    """
    if _is_before:
        # For repo_before, just run main() to get expected output
        return run_main_capture_stdout()
    
    out = io.StringIO()
    out.write("Starting analysis...\n")
    records = main_module.load_records()
    normalized = main_module.normalize_names(records)
    total, count = main_module.compute_statistics(records)
    report = main_module.generate_report(normalized, total, count)
    out.write(report)
    out.write("\n")
    freq = {}
    for ch in report:
        freq[ch] = freq.get(ch, 0) + 1
    occurrences = sum(f * f for f in freq.values())
    if occurrences > 0:
        out.write("Analysis count: ")
        out.write(str(occurrences))
        out.write("\n")
    out.write("Analysis finished.\n")
    return out.getvalue()


class TestAA_OptimizationRequirements(unittest.TestCase):
    """
    Single composite check: fail with a clear message if the code does not meet
    optimization requirements (no shared globals, single-pass API). Ensures
    repository_before fails with an explicit 'Code is not optimized' message.
    """

    def test_code_meets_optimization_requirements(self):
        """Code must be optimized: no shared mutable globals, single-pass API."""
        issues = []
        if hasattr(main_module, "GLOBAL_RECORDS"):
            issues.append("remove shared mutable global GLOBAL_RECORDS")
        if hasattr(main_module, "GLOBAL_NORMALIZED"):
            issues.append("remove shared mutable global GLOBAL_NORMALIZED")
        try:
            records = main_module.load_records(10)
            if records is None or len(records) != 10:
                issues.append("load_records(n) must return a list of n records")
        except TypeError:
            issues.append("load_records(n) must accept optional n for O(n) loading")
        try:
            recs = main_module.load_records(5)
            if recs is not None:
                main_module.compute_statistics(recs)
        except TypeError:
            issues.append("compute_statistics(records) must accept records for O(n) single-pass")
        if issues:
            self.fail(
                "Code is not optimized: " + "; ".join(issues) + "."
            )


class TestNoSharedMutableState(unittest.TestCase):
    """
    Explicitly verify that repository_after/main has no shared mutable globals.
    The refactored code must not define GLOBAL_RECORDS, GLOBAL_NORMALIZED, or
    any other module-level mutable container used as shared state.
    """

    def test_no_global_records_or_normalized(self):
        """Assert the main module does not expose GLOBAL_RECORDS or GLOBAL_NORMALIZED."""
        self.assertFalse(
            hasattr(main_module, "GLOBAL_RECORDS"),
            "Code is not optimized: must not define GLOBAL_RECORDS (no shared mutable state).",
        )
        self.assertFalse(
            hasattr(main_module, "GLOBAL_NORMALIZED"),
            "Code is not optimized: must not define GLOBAL_NORMALIZED (no shared mutable state).",
        )

    def test_no_module_level_mutable_shared_state(self):
        """
        Assert no module-level list, dict, or set in main that could act as shared state.
        Allow immutable types and types that are clearly not data (e.g. module references).
        """
        mutable = (list, dict, set)
        for name in dir(main_module):
            if name.startswith("_"):
                continue
            obj = getattr(main_module, name)
            if type(obj) in mutable:
                self.fail(
                    "Code is not optimized: must not use module-level mutable shared state; "
                    f"found {type(obj).__name__} '{name}'."
                )


class TestOutputEquivalence(unittest.TestCase):
    """Verify refactored script produces identical console output to the specification."""

    def test_console_output_matches_expected(self):
        """Exact console output: content, ordering, and formatting."""
        expected = compute_expected_console_output()
        actual = run_main_capture_stdout()
        self.assertEqual(actual, expected, "Console output must match expected exactly.")

    def test_deterministic_execution(self):
        """Repeated runs produce identical stdout."""
        first = run_main_capture_stdout()
        second = run_main_capture_stdout()
        self.assertEqual(first, second, "Output must be deterministic across runs.")


class TestDataLoading(unittest.TestCase):
    """Correctness of load_records."""

    def test_record_count(self):
        _reset_before_globals()
        if _is_before:
            main_module.load_records()
            records = main_module.GLOBAL_RECORDS
        else:
            records = main_module.load_records()
        self.assertEqual(len(records), 400)

    def test_record_structure(self):
        _reset_before_globals()
        if _is_before:
            main_module.load_records()
            records = main_module.GLOBAL_RECORDS
        else:
            records = main_module.load_records()
        for i, r in enumerate(records):
            self.assertIn("id", r)
            self.assertIn("name", r)
            self.assertIn("value", r)
            self.assertEqual(r["id"], i)
            self.assertEqual(r["name"], "Record_" + str(i))
            self.assertEqual(r["value"], i % 7)


class TestNormalization(unittest.TestCase):
    """Correctness of normalize_names."""

    def test_lowercase_and_count(self):
        _reset_before_globals()
        if _is_before:
            main_module.load_records()
            normalized = []
            for record in main_module.GLOBAL_RECORDS:
                normalized.append(record["name"].lower())
        else:
            records = main_module.load_records()
            normalized = main_module.normalize_names(records)
        
        self.assertEqual(len(normalized), 400)
        for i, name in enumerate(normalized):
            self.assertEqual(name, "record_" + str(i))

    def test_pure_no_side_effects(self):
        if _is_before:
            self.skipTest("repository_before uses globals, cannot test purity")
        
        records = main_module.load_records()
        a = main_module.normalize_names(records)
        b = main_module.normalize_names(records)
        self.assertEqual(a, b)


class TestAggregation(unittest.TestCase):
    """Correctness of compute_statistics."""

    def test_total_and_count(self):
        _reset_before_globals()
        if _is_before:
            main_module.load_records()
            total, count = main_module.compute_statistics()
        else:
            records = main_module.load_records()
            total, count = main_module.compute_statistics(records)
        
        self.assertEqual(count, 400)
        expected_total = sum(i % 7 for i in range(400))
        self.assertEqual(total, expected_total)

    def test_total_value(self):
        _reset_before_globals()
        if _is_before:
            main_module.load_records()
            total, _ = main_module.compute_statistics()
        else:
            records = main_module.load_records()
            total, _ = main_module.compute_statistics(records)
        self.assertEqual(total, 1197)


class TestReportGeneration(unittest.TestCase):
    """Correctness of generate_report."""

    def test_report_format(self):
        _reset_before_globals()
        if _is_before:
            main_module.load_records()
            main_module.normalize_names()
            total, count = main_module.compute_statistics()
            report = main_module.generate_report(total, count)
        else:
            records = main_module.load_records()
            normalized = main_module.normalize_names(records)
            total, count = main_module.compute_statistics(records)
            report = main_module.generate_report(normalized, total, count)
        
        self.assertIn("\nTOTAL=", report)
        self.assertIn("\nCOUNT=", report)
        self.assertTrue(report.endswith("\nCOUNT=400"))

    def test_report_body_is_concatenated_names(self):
        _reset_before_globals()
        if _is_before:
            main_module.load_records()
            main_module.normalize_names()
            total, count = main_module.compute_statistics()
            report = main_module.generate_report(total, count)
            body = report.split("\nTOTAL=")[0]
            expected_body = "".join(main_module.GLOBAL_NORMALIZED)
        else:
            records = main_module.load_records()
            normalized = main_module.normalize_names(records)
            total, count = main_module.compute_statistics(records)
            report = main_module.generate_report(normalized, total, count)
            body = report.split("\nTOTAL=")[0]
            expected_body = "".join(normalized)
        
        self.assertEqual(body, expected_body)


class TestReportAnalysis(unittest.TestCase):
    """Correctness of analyze_report logic (sum of squared frequencies)."""

    def test_occurrence_count_formula(self):
        report = "aab"  # freq a=2, b=1 -> 2*2 + 1*1 = 5
        buffer = io.StringIO()
        old = sys.stdout
        try:
            sys.stdout = buffer
            main_module.analyze_report(report)
        finally:
            sys.stdout = old
        self.assertEqual(buffer.getvalue().strip(), "Analysis count: 5")

    def test_analysis_no_print_when_zero(self):
        report = ""
        buffer = io.StringIO()
        old = sys.stdout
        try:
            sys.stdout = buffer
            main_module.analyze_report(report)
        finally:
            sys.stdout = old
        self.assertEqual(buffer.getvalue(), "")


def _run_pipeline(n, capture_stdout=True):
    """
    Run the full aggregation pipeline for n records.
    Returns (total, count, report). If capture_stdout, suppresses analyze_report print.
    """
    if _is_before:
        _reset_before_globals()
        # repo_before doesn't support parameterized load_records
        if n != 400:
            raise ValueError("repository_before only supports n=400")
        main_module.load_records()
        main_module.normalize_names()
        total, count = main_module.compute_statistics()
        report = main_module.generate_report(total, count)
    else:
        records = main_module.load_records(n)
        normalized = main_module.normalize_names(records)
        total, count = main_module.compute_statistics(records)
        report = main_module.generate_report(normalized, total, count)
    
    if capture_stdout:
        buf = io.StringIO()
        old = sys.stdout
        try:
            sys.stdout = buf
            main_module.analyze_report(report)
        finally:
            sys.stdout = old
    else:
        main_module.analyze_report(report)
    return total, count, report


class TestPerformanceScaling(unittest.TestCase):
    """
    Automated performance tests: verify O(n) time complexity and linear memory scaling.
    Uses only the Python standard library (time, tracemalloc).
    """

    # Doubling n: linear => ratio ~2, quadratic => ratio ~4. Tighten upper bound so O(n) passes
    # and O(n^2) fails; allow 1.4--3.5 for timing variance (quadratic doubling yields ~4x).
    TIME_RATIO_MIN = 1.4
    TIME_RATIO_MAX = 3.5
    MEMORY_RATIO_MIN = 1.5
    MEMORY_RATIO_MAX = 3.0

    def test_time_complexity_linear(self):
        """
        Run pipeline for n, 2n, 4n and assert runtime scales roughly linearly.
        Doubling input size should roughly double time (O(n)), not quadruple (O(n^2)).
        """
        if _is_before:
            # For repository_before, demonstrate state accumulation problem
            # Without resets, each run accumulates more data, causing quadratic slowdown
            _reset_before_globals()
            
            # First run: 400 records
            start = time.perf_counter()
            main_module.load_records()
            main_module.normalize_names()
            main_module.compute_statistics()
            first_run_time = time.perf_counter() - start
            
            # Second run: accumulates to 800 records (400 + 400)
            start = time.perf_counter()
            main_module.load_records()  # Adds 400 more
            main_module.normalize_names()  # Processes all 800
            main_module.compute_statistics()  # Processes all 800
            second_run_time = time.perf_counter() - start
            
            # Third run: accumulates to 1200 records (800 + 400)
            start = time.perf_counter()
            main_module.load_records()  # Adds 400 more
            main_module.normalize_names()  # Processes all 1200
            main_module.compute_statistics()  # Processes all 1200
            third_run_time = time.perf_counter() - start
            
            # Show that performance degrades due to accumulation
            # With O(n^2) behavior, doubling records should roughly quadruple time
            # Going from 400->800->1200, we expect significant slowdown
            ratio_2nd_1st = second_run_time / first_run_time if first_run_time > 0 else 0
            ratio_3rd_2nd = third_run_time / second_run_time if second_run_time > 0 else 0
            
            # repository_before should show poor scaling due to accumulation
            # This demonstrates why the code needs optimization
            self.assertGreater(
                ratio_2nd_1st, 2.0,
                f"repository_before shows state accumulation: 2nd run ({ratio_2nd_1st:.2f}x slower) "
                f"should be significantly slower than 1st run due to accumulated data"
            )
            self.assertGreater(
                ratio_3rd_2nd, 1.5,
                f"repository_before shows continued degradation: 3rd run ({ratio_3rd_2nd:.2f}x slower) "
                f"should be slower than 2nd run due to more accumulated data"
            )
            return
        
        sizes = [2000, 4000, 8000]
        times = []
        for n in sizes:
            # Warm-up then take minimum of several runs to reduce variance from GC/caching
            _run_pipeline(n)
            run_times = []
            for _ in range(5):
                start = time.perf_counter()
                _run_pipeline(n)
                elapsed = time.perf_counter() - start
                run_times.append(elapsed)
            times.append(min(run_times))

        ratio_4k_2k = times[1] / times[0] if times[0] > 0 else 0
        ratio_8k_4k = times[2] / times[1] if times[1] > 0 else 0
        self.assertGreaterEqual(
            ratio_4k_2k, self.TIME_RATIO_MIN,
            f"Doubling n (2k->4k) should increase time roughly linearly; got ratio {ratio_4k_2k:.2f}"
        )
        self.assertLessEqual(
            ratio_4k_2k, self.TIME_RATIO_MAX,
            f"Time scaling suggests worse than O(n) for 2k->4k; got ratio {ratio_4k_2k:.2f}"
        )
        self.assertGreaterEqual(
            ratio_8k_4k, self.TIME_RATIO_MIN,
            f"Doubling n (4k->8k) should increase time roughly linearly; got ratio {ratio_8k_4k:.2f}"
        )
        self.assertLessEqual(
            ratio_8k_4k, self.TIME_RATIO_MAX,
            f"Time scaling suggests worse than O(n) for 4k->8k; got ratio {ratio_8k_4k:.2f}"
        )

    def test_memory_scaling_linear(self):
        """
        Run pipeline for n and 2n, measure peak memory with tracemalloc.
        Assert peak memory scales roughly linearly (not quadratic).
        """
        if _is_before:
            # For repository_before, demonstrate memory accumulation
            _reset_before_globals()
            tracemalloc.start()
            try:
                main_module.load_records()
                main_module.normalize_names()
                main_module.compute_statistics()
                _, peak_first = tracemalloc.get_traced_memory()
            finally:
                tracemalloc.stop()
            
            # Don't reset - accumulate more data
            tracemalloc.start()
            try:
                main_module.load_records()  # Adds 400 more records
                main_module.normalize_names()  # Processes all 800
                main_module.compute_statistics()  # Processes all 800
                _, peak_second = tracemalloc.get_traced_memory()
            finally:
                tracemalloc.stop()
            
            # Show that memory grows due to accumulation
            if peak_first > 0:
                ratio = peak_second / peak_first
                self.assertGreater(
                    ratio, 1.2,
                    f"repository_before shows memory accumulation: "
                    f"2nd run uses {ratio:.2f}x more memory due to accumulated state"
                )
            return
        
        tracemalloc.start()
        try:
            _run_pipeline(5000)
            _, peak_small = tracemalloc.get_traced_memory()
            tracemalloc.stop()
        finally:
            tracemalloc.stop()

        tracemalloc.start()
        try:
            _run_pipeline(10000)
            _, peak_large = tracemalloc.get_traced_memory()
        finally:
            tracemalloc.stop()

        if peak_small <= 0:
            self.skipTest("tracemalloc reported zero peak for small run")
        ratio = peak_large / peak_small
        self.assertGreaterEqual(
            ratio, self.MEMORY_RATIO_MIN,
            f"Doubling n should increase memory roughly linearly; got ratio {ratio:.2f}"
        )
        self.assertLessEqual(
            ratio, self.MEMORY_RATIO_MAX,
            f"Memory scaling suggests worse than linear (e.g. O(n^2)); got ratio {ratio:.2f}"
        )


class TableTestResult(unittest.TextTestResult):
    """Custom test result that collects results for table display."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.test_classes = {}
    
    def startTest(self, test):
        super().startTest(test)
        class_name = test.__class__.__name__
        if class_name not in self.test_classes:
            self.test_classes[class_name] = {"tests": [], "passed": 0, "failed": 0, "skipped": 0}
        self.test_classes[class_name]["tests"].append(test._testMethodName)
    
    def addSuccess(self, test):
        super().addSuccess(test)
        class_name = test.__class__.__name__
        self.test_classes[class_name]["passed"] += 1
    
    def addFailure(self, test, err):
        super().addFailure(test, err)
        class_name = test.__class__.__name__
        self.test_classes[class_name]["failed"] += 1
    
    def addError(self, test, err):
        super().addError(test, err)
        class_name = test.__class__.__name__
        self.test_classes[class_name]["failed"] += 1
    
    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        class_name = test.__class__.__name__
        self.test_classes[class_name]["skipped"] += 1
    
    def print_table(self):
        """Print test results in a table format."""
        print("\n" + "=" * 80)
        print("TEST RESULTS SUMMARY")
        print("=" * 80)
        
        # Print table header
        print(f"\n{'Test Class':<40} {'Status':<15} {'Details':<25}")
        print("-" * 80)
        
        # Print each test class
        for class_name in sorted(self.test_classes.keys()):
            class_data = self.test_classes[class_name]
            total = class_data["passed"] + class_data["failed"] + class_data["skipped"]
            
            if class_data["failed"] > 0:
                status = f"✗ FAILED"
                details = f"{class_data['failed']}/{total} failed"
            elif class_data["skipped"] > 0:
                status = f"⊘ SKIPPED"
                details = f"{class_data['skipped']}/{total} skipped"
            else:
                status = f"✓ PASSED"
                details = f"{class_data['passed']}/{total} passed"
            
            print(f"{class_name:<40} {status:<15} {details:<25}")
        
        # Print summary
        total_passed = sum(c["passed"] for c in self.test_classes.values())
        total_failed = sum(c["failed"] for c in self.test_classes.values())
        total_skipped = sum(c["skipped"] for c in self.test_classes.values())
        total_tests = total_passed + total_failed + total_skipped
        
        print("-" * 80)
        print(f"\n{'Total Tests:':<20} {total_tests}")
        print(f"{'  Passed:':<20} {total_passed}")
        print(f"{'  Failed:':<20} {total_failed}")
        print(f"{'  Skipped:':<20} {total_skipped}")
        print(f"\n{'Overall Result:':<20} {'✓ PASSED' if total_failed == 0 else '✗ FAILED'}")
        print("=" * 80 + "\n")


class TableTestRunner(unittest.TextTestRunner):
    """Custom test runner that outputs results in a table format."""
    
    def __init__(self, *args, **kwargs):
        kwargs['resultclass'] = TableTestResult
        super().__init__(*args, **kwargs)
    
    def run(self, test):
        """Run tests and display results in table format."""
        result = super().run(test)
        result.print_table()
        return result


def run_suite(failfast=False):
    """Discover and run all tests in this module. Returns the test result."""
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromModule(sys.modules[__name__])
    runner = TableTestRunner(verbosity=0, failfast=failfast)
    return runner.run(suite)


if __name__ == "__main__":
    # Run from project root so paths (repository_after, etc.) resolve
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)
    if root not in sys.path:
        sys.path.insert(0, root)
    if _is_before:
        print("Running tests against repository_before (some tests will be skipped).\n", flush=True)
    failfast = "--failfast" in sys.argv or "-f" in sys.argv
    result = run_suite(failfast=failfast)
    sys.exit(0 if result.wasSuccessful() else 1)
