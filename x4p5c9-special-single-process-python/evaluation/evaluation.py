"""
Evaluation script: runs tests against repository_before (expected to fail) and
repository_after (refactor; must pass). main.py is only in repository_after.
Writes evaluation/reports/report.json. Intended for use in Docker.
Uses only the Python standard library.
"""

import json
import os
import platform
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = ROOT / "evaluation" / "reports"


def get_environment_info():
    """Return environment details for the report."""
    return {
        "python_version": sys.version.split()[0],
        "platform": platform.platform(),
        "arch": platform.machine(),
        "cpus": os.cpu_count(),
    }


def run_tests(repo_path: str) -> dict:
    """
    Run the unittest suite with REPO_PATH set to the given folder.
    For repository_before we use --failfast so it stops after the first failure
    (the old code is slow and would hang on tests that run main() twice).
    Returns dict with passed, return_code, output.
    """
    env = {**os.environ, "CI": "true", "REPO_PATH": repo_path}
    args = [sys.executable, "-m", "unittest", "tests.test_main", "-v"]
    if repo_path == "repository_before":
        args.append("--failfast")
    try:
        result = subprocess.run(
            args,
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
        )
        output = result.stdout or ""
        if result.stderr:
            output = (output + "\n" + result.stderr).strip()
        return {
            "passed": result.returncode == 0,
            "return_code": result.returncode,
            "output": output or "No output.",
        }
    except subprocess.TimeoutExpired:
        return {
            "passed": False,
            "return_code": -1,
            "output": "Test run timed out.",
        }
    except Exception as e:
        return {
            "passed": False,
            "return_code": -1,
            "output": str(e),
        }


def run_baseline_script() -> dict:
    """
    Run repository_before/main.py as a baseline (script only, no unittest).
    The refactored tests target the new API; the baseline is run directly.
    """
    script = ROOT / "repository_before" / "main.py"
    if not script.exists():
        return {
            "passed": False,
            "return_code": -1,
            "output": "repository_before/main.py not found.",
        }
    try:
        result = subprocess.run(
            [sys.executable, str(script)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=60,
        )
        output = result.stdout or ""
        if result.stderr:
            output = (output + "\n" + result.stderr).strip()
        return {
            "passed": result.returncode == 0,
            "return_code": result.returncode,
            "output": output or "No output.",
        }
    except subprocess.TimeoutExpired:
        return {"passed": False, "return_code": -1, "output": "Baseline script timed out."}
    except Exception as e:
        return {"passed": False, "return_code": -1, "output": str(e)}


def run_evaluation():
    """Run baseline and refactor checks, then write report.json."""
    run_id = str(uuid.uuid4())
    start_time = datetime.now(timezone.utc)
    start_iso = start_time.isoformat()

    print(f"Starting evaluation (Run ID: {run_id})...")

    print("Running tests against repository_before (expected to fail)...")
    before_result = run_tests("repository_before")

    print("Running tests against repository_after (refactor)...")
    after_result = run_tests("repository_after")

    end_time = datetime.now(timezone.utc)
    end_iso = end_time.isoformat()
    duration_seconds = (end_time - start_time).total_seconds()

    if not before_result["passed"] and after_result["passed"]:
        improvement_summary = "Refactor fixed failing tests and met requirements."
    elif before_result["passed"] and after_result["passed"]:
        improvement_summary = "Baseline and refactor both passed (refactor preserves behavior)."
    elif not after_result["passed"]:
        improvement_summary = "Refactored code failed to pass requirements."
    else:
        improvement_summary = "No improvement detected."

    report = {
        "run_id": run_id,
        "started_at": start_iso,
        "finished_at": end_iso,
        "duration_seconds": round(duration_seconds, 2),
        "environment": get_environment_info(),
        "before": {
            "tests": {
                "passed": before_result["passed"],
                "return_code": before_result["return_code"],
                "output": (before_result["output"] or "")[:500],
            },
            "metrics": {},
        },
        "after": {
            "tests": {
                "passed": after_result["passed"],
                "return_code": after_result["return_code"],
                "output": (after_result["output"] or "")[:500],
            },
            "metrics": {},
        },
        "comparison": {
            "passed_gate": after_result["passed"],
            "improvement_summary": improvement_summary,
        },
        "success": after_result["passed"],
        "error": None,
    }

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / "report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Evaluation complete. Success: {report['success']}")
    print(f"Report written to: {report_path}")

    return 0 if report["success"] else 1


if __name__ == "__main__":
    sys.exit(run_evaluation())
