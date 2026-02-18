#!/usr/bin/env python3
"""
Automated evaluation script for Python Gallery Pagination Optimization.
Generates a structured JSON report with test results and criteria analysis.
"""

import os
import sys
import json
import time
import platform
import subprocess
from datetime import datetime
from pathlib import Path
import secrets

# --- Configuration ---
ROOT_DIR = Path(__file__).parent.parent
OUTPUT_PATH = os.environ.get('OUTPUT', ROOT_DIR / 'evaluation' / 'report.json')
TIMEOUT = 300  # 5 minutes for comprehensive test suite

FORBIDDEN_MARKERS = [
    "MemoryError",
    "RecursionError",
    "SystemError",
    "KeyboardInterrupt",
    "SystemExit",
    "GeneratorExit",
    "Segmentation fault",
    "core dumped",
    "heap out of memory",
    "JavaScript heap out of memory",
]

# Test commands for both implementations
TEST_CMDS = {
    'before': ['pytest', '-q', '--tb=short'],
    'after': ['pytest', '-q', '--tb=short'],
}


def run_command(cmd, cwd, env_vars=None):
    """Execute a command and capture output."""
    env = os.environ.copy()
    if env_vars:
        env.update(env_vars)

    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            timeout=TIMEOUT
        )
        return {
            'exit_code': result.returncode,
            'stdout': result.stdout,
            'stderr': result.stderr
        }
    except subprocess.TimeoutExpired:
        return {
            'exit_code': -1,
            'stdout': '',
            'stderr': f'Command timed out after {TIMEOUT} seconds'
        }
    except Exception as e:
        return {
            'exit_code': -1,
            'stdout': '',
            'stderr': str(e)
        }


def parse_pytest_output(output):
    """Parse pytest output to extract test results."""
    import re

    tests = []
    summary = {
        'total': 0,
        'passed': 0,
        'failed': 0,
        'skipped': 0,
        'errors': 0
    }

    # Parse summary line: "1 failed, 71 passed in 19.14s" or "72 passed in 23.47s"
    lines = output.split('\n')
    for line in lines:
        if 'passed' in line and ' in ' in line and 's' in line:
            # Match "X passed"
            passed_match = re.search(r'(\d+)\s+passed', line)
            if passed_match:
                summary['passed'] = int(passed_match.group(1))

            # Match "X failed"
            failed_match = re.search(r'(\d+)\s+failed', line)
            if failed_match:
                summary['failed'] = int(failed_match.group(1))

            # Match "X skipped"
            skipped_match = re.search(r'(\d+)\s+skipped', line)
            if skipped_match:
                summary['skipped'] = int(skipped_match.group(1))

            # Calculate total
            summary['total'] = summary['passed'] + summary['failed'] + summary['skipped']
            break

    # Extract individual test results from FAILED lines
    for line in lines:
        if line.startswith('FAILED'):
            # Extract test name
            test_name = line.replace('FAILED', '').strip()
            tests.append({
                'name': test_name,
                'outcome': 'failed'
            })

    return {'summary': summary, 'tests': tests}


def run_performance_benchmark(repo_path):
    """Run performance benchmark on a repository."""
    print(f"  Benchmarking {repo_path.name}...")

    # Import the gallery module
    sys.path.insert(0, str(repo_path))
    try:
        import gallery
        from datetime import timedelta

        # Generate test data
        images = []
        base_date = datetime(2020, 1, 1)
        for i in range(10000):
            img = gallery.Image(
                id=f"img_{i:06d}",
                filename=f"photo_{i:06d}.jpg",
                album_id=f"album_{i % 10:03d}" if i % 5 != 0 else None,
                uploaded_at=base_date + timedelta(seconds=i),
                size_bytes=1000000,
                width=1920,
                height=1080
            )
            images.append(img)

        g = gallery.ImageGallery()
        g.add_images(images)

        # Benchmark different page numbers
        benchmarks = []
        for page_num in [1, 10, 50, 100, 500]:
            start = time.perf_counter()
            result = g.get_paginated_images(page=page_num, page_size=20)
            elapsed = (time.perf_counter() - start) * 1000  # Convert to ms

            benchmarks.append({
                'page': page_num,
                'time_ms': round(elapsed, 3),
                'images_retrieved': len(result['images'])
            })

        # Calculate average time
        avg_time = sum(b['time_ms'] for b in benchmarks) / len(benchmarks)

        # Check if time is constant (O(k)) or grows with page number (O(n))
        first_page_time = benchmarks[0]['time_ms']
        last_page_time = benchmarks[-1]['time_ms']
        time_variance = abs(last_page_time - first_page_time) / first_page_time if first_page_time > 0 else 0

        is_ok_complexity = time_variance < 2.0  # Less than 2x variance suggests O(k)

        return {
            'success': True,
            'benchmarks': benchmarks,
            'average_time_ms': round(avg_time, 3),
            'is_ok_complexity': is_ok_complexity,
            'time_variance': round(time_variance, 2)
        }

    except Exception as e:
        import traceback
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc(),
            'benchmarks': []
        }
    finally:
        sys.path.pop(0)
        # Remove imported module to avoid conflicts
        if 'gallery' in sys.modules:
            del sys.modules['gallery']


def get_env_info():
    """Gather environment information."""
    info = {
        'platform': f"{platform.system()} {platform.machine()}",
        'python': platform.python_version(),
    }

    # Check for available tools
    tools = ['docker', 'git', 'pytest']
    for tool in tools:
        try:
            result = subprocess.run(
                [tool, '--version'],
                capture_output=True,
                timeout=5
            )
            info[tool] = 'available' if result.returncode == 0 else 'unavailable'
        except:
            info[tool] = 'unknown'

    return info


def check_repository_before_exists():
    """Verify repository_before directory exists with unoptimized implementation."""
    before_path = ROOT_DIR / 'repository_before'

    if not before_path.exists():
        return False

    # Check if gallery.py exists (the unoptimized implementation)
    gallery_file = before_path / 'gallery.py'
    return gallery_file.exists()


def random_hex(bytes_count):
    """Generate random hex string."""
    return secrets.token_hex(bytes_count)


def main():
    """Main evaluation routine."""
    run_id = random_hex(4)

    print("=" * 60)
    print("Python Gallery Pagination Optimization Evaluation")
    print("=" * 60)
    print(f"Run ID: {run_id}\n")

    start_time = datetime.utcnow().isoformat() + 'Z'
    results = {}

    # Test repository_before (unoptimized)
    print("[1/4] Testing repository_before (unoptimized)...")
    before_env = {'PYTHONPATH': str(ROOT_DIR / 'repository_before')}
    before_test = run_command(TEST_CMDS['before'], ROOT_DIR, before_env)
    before_output = before_test['stdout'] + before_test['stderr']
    before_parsed = parse_pytest_output(before_output)

    results['repository_before'] = {
        'success': before_test['exit_code'] == 0,
        'exit_code': before_test['exit_code'],
        'summary': before_parsed['summary'],
        'tests': before_parsed['tests'],
        'output': before_output[:5000]  # Limit output size
    }

    # Test repository_after (optimized)
    print("[2/4] Testing repository_after (optimized)...")
    after_env = {'PYTHONPATH': str(ROOT_DIR / 'repository_after')}
    after_test = run_command(TEST_CMDS['after'], ROOT_DIR, after_env)
    after_output = after_test['stdout'] + after_test['stderr']
    after_parsed = parse_pytest_output(after_output)

    results['repository_after'] = {
        'success': after_test['exit_code'] == 0,
        'exit_code': after_test['exit_code'],
        'summary': after_parsed['summary'],
        'tests': after_parsed['tests'],
        'output': after_output[:5000]
    }

    # Performance benchmark for repository_before
    print("[3/4] Benchmarking repository_before performance...")
    before_perf = run_performance_benchmark(ROOT_DIR / 'repository_before')
    results['repository_before']['performance'] = before_perf

    # Performance benchmark for repository_after
    print("[4/4] Benchmarking repository_after performance...")
    after_perf = run_performance_benchmark(ROOT_DIR / 'repository_after')
    results['repository_after']['performance'] = after_perf

    # Calculate performance improvement
    if before_perf['success'] and after_perf['success']:
        before_avg = before_perf['average_time_ms']
        after_avg = after_perf['average_time_ms']

        if after_avg > 0:
            speedup = before_avg / after_avg
            improvement_pct = ((before_avg - after_avg) / before_avg) * 100
        else:
            speedup = float('inf')
            improvement_pct = 100.0

        performance_comparison = {
            'before_avg_ms': before_avg,
            'after_avg_ms': after_avg,
            'speedup': round(speedup, 2),
            'improvement_percent': round(improvement_pct, 2)
        }
    else:
        performance_comparison = {
            'error': 'Performance benchmark failed',
            'before_error': before_perf.get('error'),
            'after_error': after_perf.get('error')
        }

    # Check repository_before
    repository_before_exists = check_repository_before_exists()

    # Check for forbidden markers
    forbidden_detected = any(
        any(marker in r['output'] for marker in FORBIDDEN_MARKERS)
        for r in results.values()
    )

    # Criteria analysis
    criteria = {
        'test_suite_passed': 'Pass' if results['repository_after']['success'] else 'Fail',
        'forbidden_markers': 'Fail' if forbidden_detected else 'Pass',
        'repository_before_exists': 'Pass' if repository_before_exists else 'Fail',
        'performance_improvement': 'Pass' if (
            after_perf['success'] and
            before_perf['success'] and
            after_perf['average_time_ms'] < before_perf['average_time_ms']
        ) else 'Fail',
        'ok_complexity_achieved': 'Pass' if (
            after_perf['success'] and
            after_perf.get('is_ok_complexity', False)
        ) else 'Fail'
    }

    # Generate report
    report = {
        'run_id': run_id,
        'tool': 'Python Gallery Pagination Optimizer',
        'project': 'Python Gallery Pagination Optimization (500ZHZ)',
        'started_at': start_time,
        'completed_at': datetime.utcnow().isoformat() + 'Z',
        'environment': get_env_info(),
        'runs': results,
        'performance_comparison': performance_comparison,
        'criteria_analysis': criteria,
        'summary': {
            'overall_success': all(v == 'Pass' for v in criteria.values()),
            'tests_before': results['repository_before']['summary']['total'],
            'tests_after': results['repository_after']['summary']['total'],
            'passed_before': results['repository_before']['summary']['passed'],
            'passed_after': results['repository_after']['summary']['passed']
        }
    }

    # Save report
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(report, f, indent=2)

    # Print summary
    print("\n" + "=" * 60)
    print("EVALUATION SUMMARY")
    print("=" * 60)

    for key in ['repository_before', 'repository_after']:
        result = results[key]
        status = "✓ PASS" if result['success'] else "✗ FAIL"
        print(f"{key}: {status}")
        print(f"  Tests: {result['summary']['passed']}/{result['summary']['total']} passed")

    if 'speedup' in performance_comparison:
        print(f"\nPerformance Improvement:")
        print(f"  Before: {performance_comparison['before_avg_ms']:.3f}ms average")
        print(f"  After:  {performance_comparison['after_avg_ms']:.3f}ms average")
        print(f"  Speedup: {performance_comparison['speedup']}x faster")
        print(f"  Improvement: {performance_comparison['improvement_percent']:.1f}%")

    print(f"\nCriteria Analysis:")
    for criterion, status in criteria.items():
        symbol = "✓" if status == "Pass" else "✗"
        print(f"  {symbol} {criterion}: {status}")

    print(f"\nReport saved to: {OUTPUT_PATH}")
    print("=" * 60)

    # Exit with appropriate code
    all_passed = report['summary']['overall_success']
    sys.exit(0 if all_passed else 1)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"Evaluation failed with error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
