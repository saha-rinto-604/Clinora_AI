"""Configuration bootstrap tests using synthetic env-file contents."""

import os
from pathlib import Path
import unittest
from unittest.mock import mock_open, patch

import dotenv  # Import before isolating the environment.
from app.model_runtime import MedGemmaRuntime
from app.prompts.patient_lab_report_v4 import PROMPT_VERSION


BOOTSTRAP = Path(__file__).resolve().parents[1] / "app" / "__init__.py"
SOURCE = BOOTSTRAP.read_text(encoding="utf-8")


class EnvironmentTests(unittest.TestCase):
    def load_fixture(self, content: str, *, exists: bool = True) -> None:
        source_path = Path(__file__).resolve().parent / "fixture-repo" / "ai-service" / "app" / "__init__.py"
        expected = source_path.parents[2] / ".env"
        opener = mock_open(read_data=content)
        with patch("dotenv.main.os.path.isfile", return_value=exists), patch(
            "dotenv.main.open", opener, create=True
        ):
            exec(compile(SOURCE, str(source_path), "exec"), {"__file__": str(source_path)})
        if exists:
            self.assertEqual(Path(opener.call_args.args[0]), expected)
        else:
            opener.assert_not_called()

    def test_source_relative_root_env_is_loaded_outside_repository(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            self.load_fixture("HF_MODEL=fixture-model\nAI_INTERNAL_TOKEN=fixture-secret\nLLAMA_SERVER_URL=http://127.0.0.1:8002\n")
            self.assertEqual(os.getenv("HF_MODEL"), "fixture-model")
            self.assertEqual(os.getenv("AI_INTERNAL_TOKEN"), "fixture-secret")
            self.assertEqual(os.getenv("LLAMA_SERVER_URL"), "http://127.0.0.1:8002")

    def test_explicit_process_environment_wins(self) -> None:
        with patch.dict(os.environ, {"HF_MODEL": "process-model", "AI_INTERNAL_TOKEN": "process-secret"}, clear=True):
            self.load_fixture("HF_MODEL=file-model\nAI_INTERNAL_TOKEN=file-secret\n")
            self.assertEqual(os.getenv("HF_MODEL"), "process-model")
            self.assertEqual(os.getenv("AI_INTERNAL_TOKEN"), "process-secret")

    def test_explicit_empty_process_value_is_preserved(self) -> None:
        with patch.dict(os.environ, {"HF_TOKEN": ""}, clear=True):
            self.load_fixture("HF_TOKEN=fixture-secret\n")
            self.assertEqual(os.getenv("HF_TOKEN"), "")

    def test_prompt_version_is_loaded(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            self.load_fixture("AI_PROMPT_VERSION=patient-lab-report-v4\n")
            self.assertEqual(os.getenv("AI_PROMPT_VERSION"), "patient-lab-report-v4")

    def test_missing_env_is_safe_for_docker_and_defaults(self) -> None:
        with patch.dict(os.environ, {"AI_INTERNAL_TOKEN": "container-secret"}, clear=True):
            self.load_fixture("", exists=False)
            self.assertEqual(os.getenv("AI_INTERNAL_TOKEN"), "container-secret")
            self.assertEqual(PROMPT_VERSION, "patient-lab-report-v4")
            self.assertEqual(MedGemmaRuntime().metadata.model_name, "google/medgemma-1.5-4b-it")


if __name__ == "__main__":
    unittest.main()
