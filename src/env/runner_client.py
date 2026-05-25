"""NDJSON client for the headless Node runner."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any


class HeadlessRunnerClient:
    def __init__(
        self,
        runner_cwd: Path,
        runner_cmd: tuple[str, ...],
    ) -> None:
        self.runner_cwd = runner_cwd
        self.runner_cmd = runner_cmd
        self._proc: subprocess.Popen | None = None

    def reset(self) -> dict[str, Any]:
        self._ensure_started()
        self._send({"cmd": "reset"})
        return self._read_msg()

    def step(self, input_dict: dict[str, bool]) -> dict[str, Any]:
        self._send({"cmd": "step", "input": input_dict})
        return self._read_msg()

    def close(self) -> None:
        if self._proc is None:
            return
        try:
            if self._proc.poll() is None:
                self._send({"cmd": "shutdown"})
                self._proc.wait(timeout=1.0)
        except Exception:
            pass
        if self._proc.poll() is None:
            self._proc.kill()
        self._proc = None

    def _ensure_started(self) -> None:
        if self._proc is not None and self._proc.poll() is None:
            return
        env = os.environ.copy()
        env.setdefault("NODE_OPTIONS", "--no-warnings")
        self._proc = subprocess.Popen(
            list(self.runner_cmd),
            cwd=str(self.runner_cwd),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
            env=env,
        )
        ready = self._read_msg()
        if ready.get("type") != "ready":
            raise RuntimeError(f"runner didn't say ready: {ready}")

    def _send(self, msg: dict[str, Any]) -> None:
        assert self._proc is not None and self._proc.stdin is not None
        self._proc.stdin.write(json.dumps(msg) + "\n")
        self._proc.stdin.flush()

    def _read_msg(self) -> dict[str, Any]:
        assert self._proc is not None and self._proc.stdout is not None
        line = self._proc.stdout.readline()
        if not line:
            rc = self._proc.poll()
            raise RuntimeError(f"runner pipe closed (returncode={rc})")
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            raise RuntimeError(f"bad runner output: {line!r}")
