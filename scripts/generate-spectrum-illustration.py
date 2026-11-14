#!/usr/bin/env python3
"""Generate the predeclared, separate Gaussian spectrum illustration once.

Protocol recorded in PLAN.md before generation: PCG64 seed 20261114, one
2048x4096 Gaussian array, four nested prefixes, p=n/2, population spikes 2.6
and 3.5, XX^T/n. No seed search, resampling, or forced monotonicity.

The parent process enforces 180 seconds and a conservative 512 MiB RSS stop;
the planned dense working arrays require at most 160 MiB. Existing outputs
are never overwritten. Use --output-dir for a separately authorized reproduction.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

SEED = 20261114
LEVELS = (64, 256, 1024, 4096)
SPIKES = (2.6, 3.5)
GAMMA = 0.5
BIN_WIDTH = 0.125
MAX_THREADS = 4
WALL_SECONDS = 180
MEMORY_BYTES = 512 * 1024**2
REPO = Path(__file__).resolve().parents[1]


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def worker(result_path: Path) -> None:
    # Imports occur only after the parent has set all numerical thread limits.
    import platform
    import resource
    import numpy as np
    import scipy
    from scipy.linalg import eigvalsh
    from threadpoolctl import threadpool_info, threadpool_limits

    started = time.monotonic()
    checkpoints = []
    rng = np.random.Generator(np.random.PCG64(SEED))
    with threadpool_limits(limits=MAX_THREADS):
        backends = [{key: row.get(key) for key in
                     ("user_api", "internal_api", "version", "num_threads", "architecture")}
                    for row in threadpool_info()]
        assert all(row["num_threads"] <= MAX_THREADS for row in backends)
        x = rng.standard_normal((2048, 4096), dtype=np.float64)
        x[0, :] *= np.sqrt(SPIKES[0])
        x[1, :] *= np.sqrt(SPIKES[1])
        assert np.isfinite(x).all()

        # Exactly four solves, in the recorded order. Keep all eigenvalues.
        for n in LEVELS:
            p = n // 2
            before = time.monotonic()
            prefix = x[:p, :n]
            covariance = prefix @ prefix.T
            covariance /= n
            covariance = np.asfortranarray(covariance)
            assert np.isfinite(covariance).all()
            trace = float(np.trace(covariance))
            squared_frobenius = float(np.sum(covariance * covariance))
            gram_seconds = time.monotonic() - before
            before_eigen = time.monotonic()
            eigenvalues = eigvalsh(covariance, lower=True, overwrite_a=True,
                                  check_finite=False, driver="evr")
            eigen_seconds = time.monotonic() - before_eigen
            assert eigenvalues.shape == (p,)
            assert np.isfinite(eigenvalues).all()
            assert np.all(np.diff(eigenvalues) >= 0)
            assert eigenvalues[0] > 0
            trace_error = abs(float(eigenvalues.sum()) - trace)
            squared_error = abs(float(np.dot(eigenvalues, eigenvalues)) - squared_frobenius)
            assert trace_error <= 1e-10 * max(1.0, trace)
            assert squared_error <= 1e-10 * max(1.0, squared_frobenius)
            checkpoints.append({
                "n": n, "p": p, "eigenvalues": eigenvalues.tolist(),
                "topEigenvalues": eigenvalues[-2:].tolist(),
                "gramSeconds": gram_seconds, "eigenSeconds": eigen_seconds,
                "trace": trace, "traceCheckAbsoluteError": trace_error,
                "squaredFrobenius": squared_frobenius,
                "squaredMomentCheckAbsoluteError": squared_error,
            })
            write_json(result_path.with_name("spectrum-generation-partial.json"), checkpoints)
            print(json.dumps({"completedN": n, "p": p,
                              "seconds": time.monotonic() - before}), flush=True)
            del covariance, eigenvalues, prefix

    max_eigenvalue = max(row["eigenvalues"][-1] for row in checkpoints)
    x_max = max(5.0, float(np.ceil(max_eigenvalue / BIN_WIDTH) * BIN_WIDTH))
    edges = np.arange(round(x_max / BIN_WIDTH) + 1, dtype=np.float64) * BIN_WIDTH
    maximum_height = 0.0
    for row in checkpoints:
        bulk = np.asarray(row["eigenvalues"][:-2])
        counts, _ = np.histogram(bulk, bins=edges)
        assert int(counts.sum()) == row["p"] - 2
        heights = counts / (row["p"] * BIN_WIDTH)
        maximum_height = max(maximum_height, float(heights.max()))
        row["bulkCounts"] = counts.tolist()
        row["bulkDensity"] = heights.tolist()
        row["bulkMass"] = float(heights.sum() * BIN_WIDTH)
        row["individualTopEigenvalueMass"] = 1 / row["p"]
        assert abs(row["bulkMass"] - (row["p"] - 2) / row["p"]) < 1e-12
    # Shared limits only: never rescale individual checkpoints.
    y_max = max(2.0, float(np.ceil(maximum_height * 1.05 / 0.25) * 0.25))
    data = {
        "schemaVersion": 1,
        "description": "Separate seeded Gaussian illustration, not the published Volterra experiment.",
        "gamma": GAMMA, "populationSpikes": list(SPIKES),
        "mpSupport": [(1 - np.sqrt(GAMMA))**2, (1 + np.sqrt(GAMMA))**2],
        "asymptoticSampleOutliers": [alpha * (1 + GAMMA / (alpha - 1)) for alpha in SPIKES],
        "bins": {"width": BIN_WIDTH, "edges": edges.tolist(), "xMax": x_max, "yMax": y_max},
        "checkpoints": checkpoints,
    }
    peak_rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if platform.system() != "Darwin":
        peak_rss *= 1024
    report = {
        "generatedAtUTC": datetime.now(timezone.utc).isoformat(),
        "seed": SEED, "bitGenerator": "PCG64", "largestDrawShape": [2048, 4096],
        "matrixStorageOrder": "C", "dtype": "float64", "coupling": "top-left prefixes of one Gaussian draw",
        "levels": list(LEVELS), "dimensions": [n // 2 for n in LEVELS],
        "populationSpikes": list(SPIKES), "gamma": GAMMA,
        "covarianceNormalization": "XX^T/n; known zero mean, no sample centering",
        "histogramNormalization": "counts/(p*0.125) after excluding the largest two eigenvalues",
        "histogramRangeRule": "zero to max(5,ceil(maximum observed eigenvalue/0.125)*0.125), shared by all checkpoints",
        "verticalRangeRule": "max(2,ceil(maximum histogram height*1.05/0.25)*0.25), shared by all checkpoints",
        "eigensolver": "scipy.linalg.eigvalsh, driver=evr, lower=True, overwrite_a=True, eigenvalues only",
        "solvesCompleted": len(checkpoints), "retries": 0,
        "workerWallSeconds": time.monotonic() - started,
        "peakRSSBytesWorkerOS": peak_rss, "conservativeWorkingArrayEstimateMiB": 160,
        "versions": {"python": sys.version, "numpy": np.__version__, "scipy": scipy.__version__,
                     "platform": platform.platform(), "numericalBackends": backends},
        "source": {"url": "https://arxiv.org/pdf/math/0408165v1", "authors": ["Jinho Baik", "Jack W. Silverstein"],
                   "model": "Section1.1, Eqs1.5-1.8", "bulk": "Eq1.2 and discussion on PDF pages2/5",
                   "outliers": "Theorem1.1, Eq1.10"},
        "interpretation": [
            "One coupled realization at each of four sizes illustrates finite-dimensional behavior; it does not estimate a rate or confidence level.",
            "The two stems show actual largest sample eigenvalues. They are neither forced outside the bulk nor forced toward theoretical limits.",
            "Each excluded eigenvalue has empirical mass1/p; equal-height stems encode positions only. Their finite-rank mass vanishes in the limiting MP law.",
            "Crossfades are visual transitions between computed checkpoints, not spectra at intermediate sample sizes.",
            "This synthetic Gaussian model is separate from the original published Volterra bands; their covariance and exact aspect ratio are not asserted identical.",
        ],
    }
    write_json(result_path, {"data": data, "provenance": report})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=REPO / "images/motion")
    parser.add_argument("--qa-dir", type=Path, default=Path("/private/tmp/andrew-site-motion-v4"))
    parser.add_argument("--worker-result", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.worker_result:
        worker(args.worker_result)
        return 0

    import psutil
    data_path = args.output_dir / "spectrum-concentration-data.json"
    provenance_path = args.output_dir / "spectrum-provenance.json"
    if data_path.exists() or provenance_path.exists():
        parser.error("Outputs already exist; refusing to regenerate or overwrite them.")
    args.qa_dir.mkdir(parents=True, exist_ok=True)
    result_path = args.qa_dir / "spectrum-worker-result.json"
    if result_path.exists():
        parser.error("A worker result already exists; refusing a silent retry.")
    env = os.environ.copy()
    for key in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS", "VECLIB_MAXIMUM_THREADS", "NUMEXPR_NUM_THREADS"):
        env[key] = str(MAX_THREADS)
    started = time.monotonic()
    process = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "--worker-result", str(result_path)],
                               env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    monitored = psutil.Process(process.pid)
    peak_rss = 0
    stopped_reason = None
    while True:
        try:
            peak_rss = max(peak_rss, monitored.memory_info().rss)
        except psutil.NoSuchProcess:
            pass
        if time.monotonic() - started > WALL_SECONDS:
            stopped_reason = "180-second wall budget reached"
        elif peak_rss > MEMORY_BYTES:
            stopped_reason = "512-MiB conservative RSS safety cap reached"
        if stopped_reason:
            process.kill()
            stdout, stderr = process.communicate()
            break
        try:
            stdout, stderr = process.communicate(timeout=0.1)
            break
        except subprocess.TimeoutExpired:
            continue
    elapsed = time.monotonic() - started
    (args.qa_dir / "spectrum-generation-stdout.txt").write_text(stdout)
    (args.qa_dir / "spectrum-generation-stderr.txt").write_text(stderr)
    status = {"exitCode": process.returncode, "stoppedReason": stopped_reason,
              "wallSeconds": elapsed, "peakRSSBytesMonitored": peak_rss,
              "budgets": {"wallSeconds": WALL_SECONDS, "workingArrayMiB": 512, "RSSSafetyStopMiB": 512, "threads": MAX_THREADS}}
    write_json(args.qa_dir / "spectrum-generation-status.json", status)
    sys.stdout.write(stdout)
    sys.stderr.write(stderr)
    if stopped_reason or process.returncode:
        print(json.dumps(status), file=sys.stderr)
        return 1
    result = json.loads(result_path.read_text())
    assert result["provenance"]["solvesCompleted"] == 4
    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_json(data_path, result["data"])
    provenance = result["provenance"]
    provenance.update(status)
    provenance["generatorPath"] = "scripts/generate-spectrum-illustration.py"
    provenance["generatorSHA256"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    provenance["dataPath"] = "images/motion/spectrum-concentration-data.json"
    provenance["dataSHA256"] = hashlib.sha256(data_path.read_bytes()).hexdigest()
    write_json(provenance_path, provenance)
    print(json.dumps({"data": str(data_path), "provenance": str(provenance_path), **status}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
